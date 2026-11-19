import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, randomInt } from "node:crypto";

const CONFIG = {
  home: "https://gemini.google.com/app",
  endpoint: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
  timeout: Number(process.env.GEMINI_TIMEOUT_MS || 45_000),
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

type SessionState = { cookie: string; resume?: unknown[]; resumeArray?: unknown[]; uid: string; instruction?: string };
type GeminiResult = { success: true; response: string; sessionId: string; method: "gemini-web" | "gemini-fallback"; conversationId: string | null; responseId: string | null };

const hex = (bytes: number) => randomBytes(bytes).toString("hex");

function sessionEncryptionKey() {
  const secret = process.env.GEMINI_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("GEMINI_SESSION_SECRET is not configured.");
  return createHash("sha256").update(secret, "utf8").digest();
}

function pack(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function unpack(value?: string): SessionState | null {
  if (!value || value.length > 12_000) return null;
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", sessionEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || (!Array.isArray(parsed.resume) && !Array.isArray(parsed.resumeArray))) return null;
    return parsed as SessionState;
  } catch { return null; }
}
function cleanText(value: string) {
  return value.replace(/\\\"/g, '"').replace(/\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
function buildBody(message: string, resume: unknown[], uid: string) {
  const inner = [
    [message, 0, null, null, null, null, 0], ["en-US"], resume, "", hex(16),
    null, [1], 1, null, null, 1, 0, null, null, null, null, null, [[0]], 0,
    null, null, null, null, null, null, null, null, 1, null, null, [4],
    null, null, null, null, null, null, null, null, null, null, [2],
    null, null, null, null, null, null, null, null, null, null, null, 0,
    null, null, null, null, null, uid, null, [], null, null, null, null, null, null, 2,
    null, null, null, null, null, null, null, null, null, null, 1,
  ];
  return "f.req=" + encodeURIComponent(JSON.stringify([null, JSON.stringify(inner)])) + "&";
}
function parseReply(raw: string) {
  let best = "";
  let conversationId: string | null = null;
  let responseId: string | null = null;
  let replyId: string | null = null;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('[["wrb.fr"')) continue;
    try {
      const outer = JSON.parse(trimmed);
      for (const row of outer) {
        if (!Array.isArray(row) || row[0] !== "wrb.fr" || typeof row[2] !== "string") continue;
        const body = JSON.parse(row[2]);
        const ids = body?.[1];
        if (Array.isArray(ids)) {
          if (typeof ids[0] === "string" && ids[0].startsWith("c_")) conversationId = ids[0];
          if (typeof ids[1] === "string" && ids[1].startsWith("r_")) responseId = ids[1];
        }
        const segment = body?.[4]?.[0];
        if (segment) {
          if (typeof segment[0] === "string") replyId = segment[0];
          if (Array.isArray(segment[1])) {
            const candidate = segment[1].filter((part: unknown) => typeof part === "string").join("");
            if (candidate.length > best.length) best = candidate;
          }
        }
      }
    } catch { /* Ignore non-payload transport lines. */ }
  }
  return { text: best.trim(), conversationId, responseId, replyId };
}

function buildBodyAlt(message: string, instruction = "", resumeArray: unknown[] | null = null) {
  const requestBody = [
    [message, 0, null, null, null, null, 0], ["en-US"],
    resumeArray || ["", "", "", null, null, null, null, null, null, ""],
    null, null, null, [1], 1, null, null, 1, 0, null, null, null, null, null,
    [[0]], 1, null, null, null, null, null,
    ["", "", instruction, null, null, null, null, null, 0, null, 1, null, null, null, []],
    null, null, 1, null, null, null, null, null, null, null,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    1, null, null, null, null, [1],
  ];
  return [null, JSON.stringify(requestBody)];
}

function parseMethod2(raw: string) {
  const lines = raw.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line || /^\d+$/.test(line) || line.startsWith(")]}'")) continue;
    try {
      const outer = JSON.parse(line);
      const candidate = outer?.[0]?.[2];
      if (typeof candidate !== "string") continue;
      const parsed = JSON.parse(candidate);
      const text = parsed?.[4]?.[0]?.[1]?.[0];
      if (typeof text === "string" && text.trim()) return { parsed, text };
    } catch { /* Ignore non-payload transport lines. */ }
  }
  return null;
}

async function askGeminiMethod2(message: string, instruction: string, previous: SessionState | null) {
  let cookie = previous?.cookie || "";
  const resumeArray = previous?.resumeArray || null;
  if (!cookie) {
    const boot = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": CONFIG.userAgent },
        body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",
        signal: AbortSignal.timeout(CONFIG.timeout),
        cache: "no-store",
      }
    );
    const setCookies = boot.headers.getSetCookie?.() ?? [];
    cookie = setCookies[0]?.split(";")[0] || "";
  }
  const payload = buildBodyAlt(message, instruction || previous?.instruction || "", resumeArray);
  const form = new URLSearchParams();
  form.append("f.req", JSON.stringify(payload));
  const response = await fetch(
    "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-goog-ext-525001261-jspb": '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]',
        cookie,
        "user-agent": CONFIG.userAgent,
      },
      body: form.toString(),
      signal: AbortSignal.timeout(CONFIG.timeout),
      cache: "no-store",
    }
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(`Gemini fallback returned HTTP ${response.status}.`);
  const result = parseMethod2(raw);
  if (!result) throw new Error("Gemini fallback could not parse the response.");
  const newResume = [...(Array.isArray(result.parsed[1]) ? result.parsed[1] : []), result.parsed?.[4]?.[0]?.[0] || null];
  return {
    success: true as const,
    response: cleanText(result.text),
    sessionId: pack({ resumeArray: newResume, cookie, instruction }),
    method: "gemini-fallback",
    conversationId: result.parsed?.[1]?.[0] || null,
    responseId: result.parsed?.[1]?.[1] || null,
  };
}

let bootstrapCache: { value: { cookie: string; bl: string; fsid: string; uid: string }; expiresAt: number } | null = null;
async function bootstrap() {
  if (bootstrapCache && bootstrapCache.expiresAt > Date.now()) return bootstrapCache.value;
  const response = await fetch(CONFIG.home, {
    headers: { "user-agent": CONFIG.userAgent, "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(CONFIG.timeout),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("تعذر تهيئة اتصال Gemini.");
  const cookies = response.headers.getSetCookie?.() ?? [];
  const html = await response.text();
  const value = {
    cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; "),
    bl: (html.match(/"cfb2h":"(.*?)"/) ?? [])[1] ?? "",
    fsid: (html.match(/"FdrFJe":"(.*?)"/) ?? [])[1] ?? "",
    uid: randomUUID(),
  };
  if (!value.bl || !value.fsid) throw new Error("لم يتم العثور على بيانات تهيئة Gemini.");
  bootstrapCache = { value, expiresAt: Date.now() + 4 * 60_000 };
  return value;
}

export async function askGemini(input: { prompt: string; instruction?: string; sessionId?: string }): Promise<GeminiResult> {
  const prompt = input.prompt.trim();
  const previous = unpack(input.sessionId);
  const instruction = input.instruction?.trim() || previous?.instruction || "";
  const preferFallback = Boolean(previous?.resumeArray || instruction);

  const runPrimary = async () => {
    const boot = await bootstrap();
    const cookie = previous?.cookie || boot.cookie;
    const uid = previous?.uid || boot.uid;
    const resume = previous?.resume || ["", "", "", null, null, null, null, null, null, ""];
    const message = instruction ? `${instruction}\n\n${prompt}` : prompt;
    const url = new URL(CONFIG.endpoint);
    url.searchParams.set("bl", boot.bl);
    url.searchParams.set("f.sid", boot.fsid);
    url.searchParams.set("hl", "en-US");
    url.searchParams.set("_reqid", String(randomInt(100_000, 999_999)));
    url.searchParams.set("rt", "c");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": CONFIG.userAgent,
        origin: "https://gemini.google.com",
        referer: "https://gemini.google.com/",
        "x-same-domain": "1",
        "x-goog-ext-525001261-jspb": JSON.stringify([1, null, null, null, hex(8), null, null, 0, [4, 6], null, null, 1, null, null, 1, null, randomUUID()]),
        "x-goog-ext-525005358-jspb": JSON.stringify([uid, 1]),
        "x-goog-ext-73010990-jspb": "[0,0,0]",
        "x-goog-ext-73010989-jspb": "[0]",
        cookie,
      },
      body: buildBody(message, resume, uid),
      signal: AbortSignal.timeout(CONFIG.timeout),
      cache: "no-store",
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Gemini primary returned HTTP ${response.status}.`);
    const result = parseReply(raw);
    if (!result.text) throw new Error("Gemini primary returned an empty response.");
    return {
      success: true as const,
      response: cleanText(result.text),
      sessionId: pack({ cookie, resume: [result.conversationId, result.responseId, result.replyId], uid }),
      method: "gemini-web" as const,
      conversationId: result.conversationId,
      responseId: result.responseId,
    };
  };

  const attempts = preferFallback
    ? [() => askGeminiMethod2(prompt, instruction, previous), runPrimary]
    : [runPrimary, () => askGeminiMethod2(prompt, instruction, previous)];
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      return result as GeminiResult;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown Gemini error");
    }
  }
  throw new Error(`تعذر الحصول على رد من Gemini. ${errors.join(" | ")}`.slice(0, 700));
}
