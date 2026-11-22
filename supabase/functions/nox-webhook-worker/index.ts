import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-worker-token",
  "Content-Type": "application/json; charset=utf-8",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function privateIPv4(host: string): boolean {
  const p = host.split(".");
  if (p.length !== 4 || p.some((x) => !/^\\d+$/.test(x))) return false;
  const [a, b] = p.map(Number);
  if (p.some((x) => Number(x) > 255)) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0);
}

function safeTarget(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host.endsWith(".test") || host.endsWith(".invalid") ||
      host === "metadata.google.internal" || host === "metadata") return false;
    if (privateIPv4(host)) return false;
    if (host.includes(":") && (
      host === "::1" || host === "::" || host.startsWith("fc") ||
      host.startsWith("fd") || host.startsWith("fe8") ||
      host.startsWith("fe9") || host.startsWith("fea") ||
      host.startsWith("feb") || host.startsWith("::ffff:")
    )) return false;
    return true;
  } catch {
    return false;
  }
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function responseExcerpt(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < 500) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const chunk = value.slice(0, 500 - size);
      chunks.push(chunk);
      size += chunk.length;
      if (chunk.length < value.length) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(output).slice(0, 500);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const baseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");
  const token = req.headers.get("x-worker-token");
  if (!baseUrl || !serviceKey || !token) {
    return reply(503, { error: "worker_not_configured" });
  }

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const raw = await response.text();
    let data: unknown = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 300); }
    if (!response.ok) {
      const message = typeof data === "object" && data !== null
        ? String((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error ?? response.statusText)
        : response.statusText;
      throw new Error(`${name}: ${message}`);
    }
    return data;
  };

  let deliveries: Array<{
    delivery_id: string;
    webhook_id: string;
    target_url: string;
    event_type: string;
    payload: Record<string, unknown>;
    attempt: number;
  }>;

  try {
    deliveries = await rpc("bmg_webhook_claim_deliveries", {
      p_token: token,
      p_limit: 15,
    }) as typeof deliveries;
  } catch (error) {
    return reply(401, { error: "worker_unauthorized", detail: String(error).slice(0, 180) });
  }

  let succeeded = 0;
  let failedOrRetried = 0;

  for (const item of deliveries ?? []) {
    let statusCode: number | null = null;
    let excerpt = "";
    let failure = "";

    try {
      if (!safeTarget(item.target_url)) {
        throw new Error("Target rejected by outbound URL safety policy");
      }

      const secret = await rpc("bmg_webhook_get_secret", {
        p_token: token,
        p_webhook_id: item.webhook_id,
      }) as string | null;
      if (!secret || secret.length < 32) throw new Error("Signing secret unavailable");

      const body = JSON.stringify(item.payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await sign(secret, `${timestamp}.${body}`);
      const response = await fetch(item.target_url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "NOX-APIS-Webhooks/1.0",
          "X-NOX-Event": item.event_type,
          "X-NOX-Delivery": item.delivery_id,
          "X-NOX-Timestamp": timestamp,
          "X-NOX-Signature": `sha256=${signature}`,
        },
        body,
      });
      statusCode = response.status;
      excerpt = await responseExcerpt(response);
      if (!response.ok) failure = `Remote endpoint returned HTTP ${response.status}`;
    } catch (error) {
      failure = String(error).slice(0, 500);
    }

    try {
      await rpc("bmg_webhook_finish_delivery", {
        p_token: token,
        p_delivery_id: item.delivery_id,
        p_status_code: statusCode,
        p_response_excerpt: excerpt,
        p_error: failure,
      });
      if (statusCode !== null && statusCode >= 200 && statusCode < 300) succeeded++;
      else failedOrRetried++;
    } catch {
      failedOrRetried++;
    }
  }

  return reply(200, {
    processed: deliveries?.length ?? 0,
    succeeded,
    retried_or_failed: failedOrRetried,
  });
});
