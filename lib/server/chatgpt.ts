import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

const HOME = "https://android.chat.openai.com";
const REQUIREMENTS_URL = HOME + "/backend-anon/sentinel/chat-requirements";
const CONVERSATION_URL = HOME + "/backend-anon/f/conversation";
const TIMEOUT_MS = 260_000;
const MAX_SESSION_LENGTH = 12_000;
const USER_AGENT = "ChatGPT/1.2026.181 (Android 16; Neo/1.0; build 2222222)";

type ChatSession = {
  cookie: string;
  deviceId: string;
  parentMessageId: string;
  chatId: string | null;
};

type ChatResult = {
  success: true;
  result: { think: string; message: string };
  citations: unknown[];
  raw: string;
  provider: "chatgpt";
  model: string;
  sessionId: string;
};

const MODELS: Record<string, string> = {
  default: "auto",
  auto: "auto",
  "gpt-4": "gpt-4",
  "gpt-3.5": "text-davinci-003",
};

const baseHeaders: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "OAI-Package-Name": "com.openai.chatgpt",
  "OAI-Client-Type": "android",
  "Accept-Language": "ar-EG,ar;q=0.9,en;q=0.8",
  "X-Device-Tier": "upper_mid",
  "ChatGPT-Account-Id": "default",
  "ChatGPT-Residency-Region": "no_constraint",
};

function sessionKey() {
  const secret = process.env.CHATGPT_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CHATGPT_SESSION_SECRET غير مضبوط (32 حرفًا على الأقل).",
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function packSession(value: ChatSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function unpackSession(value?: string): ChatSession | null {
  if (!value || value.length > MAX_SESSION_LENGTH) return null;
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
    const parsed = JSON.parse(plain.toString("utf8")) as Partial<ChatSession>;
    if (
      typeof parsed.cookie !== "string" ||
      typeof parsed.deviceId !== "string" ||
      typeof parsed.parentMessageId !== "string" ||
      !(typeof parsed.chatId === "string" || parsed.chatId === null)
    ) return null;
    return parsed as ChatSession;
  } catch {
    return null;
  }
}

function uuid() {
  return randomUUID();
}

function parseCookies(values: string[]) {
  const result: Record<string, string> = {};
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    result[pair.slice(0, separator).trim()] = pair.slice(separator + 1).trim();
  }
  return result;
}

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
}

function cleanSpecialTags(value: string) {
  return value
    .replace(/\uE200entity\uE202([^\uE201]+)\uE201/g, (_match, payload: string) => {
      try {
        const parsed = JSON.parse(payload);
        return String(parsed?.[1] || parsed?.[0] || "");
      } catch {
        return "";
      }
    })
    .replace(/\uE200[^\uE201]*\uE201/g, "")
    .trim();
}

function readMessage(data: Record<string, unknown>, state: {
  text: string;
  chatId: string | null;
  assistantMessageId: string | null;
  lastPath: string | null;
  lastOp: string | null;
}) {
  if (typeof data.conversation_id === "string") state.chatId = data.conversation_id;
  const path = typeof data.p === "string" ? data.p : state.lastPath;
  const operation = typeof data.o === "string" ? data.o : state.lastOp;
  if (typeof data.p === "string") state.lastPath = data.p;
  if (typeof data.o === "string") state.lastOp = data.o;

  if (operation === "add" && data.v && typeof data.v === "object") {
    const message = (data.v as Record<string, unknown>).message;
    if (message && typeof message === "object") {
      const item = message as Record<string, unknown>;
      const author = item.author && typeof item.author === "object"
        ? item.author as Record<string, unknown>
        : null;
      if (author?.role === "assistant") {
        if (typeof item.id === "string") state.assistantMessageId = item.id;
        const content = item.content && typeof item.content === "object"
          ? item.content as Record<string, unknown>
          : null;
        const parts = content?.parts;
        if (Array.isArray(parts) && typeof parts[0] === "string") state.text = parts[0];
      }
    }
  } else if (operation === "patch" && Array.isArray(data.v)) {
    for (const entry of data.v as unknown[]) {
      if (!entry || typeof entry !== "object") continue;
      const patch = entry as Record<string, unknown>;
      const patchPath = typeof patch.p === "string" ? patch.p : "";
      if (patch.o === "append" && typeof patch.v === "string" && patchPath.startsWith("/message/content/parts/")) {
        state.text += patch.v;
      } else if (patch.o === "replace" && typeof patch.v === "string" && patchPath.startsWith("/message/content/parts/")) {
        state.text = patch.v;
      }
    }
  } else if (
    operation === "append" &&
    typeof path === "string" &&
    path.startsWith("/message/content/parts/") &&
    typeof data.v === "string"
  ) {
    state.text += data.v;
  }
}

async function createSession(deviceId: string): Promise<ChatSession> {
  const response = await fetch(REQUIREMENTS_URL, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "OAI-Device-Id": deviceId,
      "X-OpenAI-Target-Path": "/backend-anon/sentinel/chat-requirements",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error("ChatGPT session initialization returned HTTP " + response.status + ".");
  const data = await response.json() as Record<string, unknown>;
  const cookies = parseCookies(getSetCookies(response));
  let oaiSc = cookies["oai-sc"];
  if (!oaiSc && typeof data.token === "string") oaiSc = "0" + data.token;
  const cookie = [
    ...(oaiSc ? ["oai-sc=" + oaiSc] : []),
    ...Object.entries(cookies).filter(([name]) => name !== "oai-sc").map(([name, value]) => name + "=" + value),
  ].join("; ");

  if (!cookie) throw new Error("ChatGPT did not return the required anonymous session cookie.");
  return { cookie, deviceId, parentMessageId: uuid(), chatId: null };
}

export async function askChatGPT(input: {
  message: string;
  model?: string;
  sessionId?: string;
}): Promise<ChatResult> {
  const message = input.message.trim();
  if (!message) throw new Error("الحقل message مطلوب.");
  const requestedModel = input.model || "default";
  const model = MODELS[requestedModel];
  if (!model) throw new Error("قيمة model غير مدعومة.");

  const previous = unpackSession(input.sessionId);
  if (input.sessionId && !previous) throw new Error("sessionId غير صالح أو انتهت صلاحيته.");

  const deviceId = previous?.deviceId || uuid();
  const session = previous || await createSession(deviceId);
  const currentMessageId = uuid();
  const headers: Record<string, string> = {
    ...baseHeaders,
    "OAI-Device-Id": session.deviceId,
    "X-OpenAI-Target-Path": "/backend-anon/f/conversation",
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Cookie: session.cookie,
  };

  const body = {
    action: "next",
    messages: [{
      id: currentMessageId,
      author: { role: "user" },
      content: { content_type: "text", parts: [message] },
      status: "finished_successfully",
      recipient: "all",
    }],
    model,
    conversation_id: session.chatId || undefined,
    parent_message_id: session.parentMessageId,
    history_and_training_disabled: false,
    enable_message_followups: true,
    force_use_sse: true,
    supported_encodings: ["v1"],
    supports_buffering: true,
    timezone: "Africa/Cairo",
    timezone_offset_min: -120,
    stream: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("ChatGPT request timed out after 260 seconds.")), TIMEOUT_MS);
  const state = {
    text: "",
    chatId: session.chatId,
    assistantMessageId: null as string | null,
    lastPath: null as string | null,
    lastOp: null as string | null,
  };
  let buffer = "";

  try {
    const response = await fetch(CONVERSATION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("ChatGPT upstream returned HTTP " + response.status + ".");
    if (!response.body) throw new Error("ChatGPT returned an empty response stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            readMessage(JSON.parse(payload) as Record<string, unknown>, state);
          } catch {
            // Ignore malformed or non-JSON SSE frames.
          }
        }
      }
      buffer += decoder.decode();
      if (buffer.trim().startsWith("data:")) {
        const payload = buffer.trim().slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try { readMessage(JSON.parse(payload) as Record<string, unknown>, state); } catch { /* Ignore final malformed frame. */ }
        }
      }
    } catch (cause) {
      if (!state.text.trim()) {
        if (controller.signal.aborted) throw new Error("ChatGPT request timed out after 260 seconds.");
        throw cause;
      }
    } finally {
      reader.releaseLock();
    }

    const finalMessage = cleanSpecialTags(state.text);
    if (!finalMessage) throw new Error("ChatGPT returned no message content.");

    const nextSession: ChatSession = {
      cookie: session.cookie,
      deviceId: session.deviceId,
      parentMessageId: state.assistantMessageId || session.parentMessageId,
      chatId: state.chatId,
    };

    return {
      success: true,
      result: { think: "", message: finalMessage },
      citations: [],
      raw: state.text,
      provider: "chatgpt",
      model: requestedModel,
      sessionId: packSession(nextSession),
    };
  } finally {
    clearTimeout(timeout);
  }
}
