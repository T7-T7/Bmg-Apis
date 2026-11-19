import { randomBytes, randomUUID, randomInt } from "node:crypto";

const CONFIG = {
  home: "https://gemini.google.com/app",
  endpoint: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
  timeout: Number(process.env.GEMINI_TIMEOUT_MS || 45_000),
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

type SessionState = { cookie: string; resume: unknown[]; uid: string };
type GeminiResult = { success: true; response: string; sessionId: string; method: "gemini-web"; conversationId: string | null; responseId: string | null };

const hex = (bytes: number) => randomBytes(bytes).toString("hex");
const pack = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function unpack(value?: string): SessionState | null {
  if (!value || value.length > 12_000) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.resume)) return null;
    return parsed as SessionState;
  } catch { return null; }
}
function cleanText(value: string) {
  return value.replace(/\\\"/g, '"').replace(/\\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
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
  const boot = await bootstrap();
  const cookie = previous?.cookie || boot.cookie;
  const uid = previous?.uid || boot.uid;
  const resume = previous?.resume || ["", "", "", null, null, null, null, null, null, ""];
  const instruction = input.instruction?.trim();
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
  if (!response.ok) throw new Error(`Gemini upstream returned HTTP ${response.status}.`);
  const result = parseReply(raw);
  if (!result.text) throw new Error("Gemini لم يُرجع نصًا مفهومًا.");
  return {
    success: true,
    response: cleanText(result.text),
    sessionId: pack({ cookie, resume: [result.conversationId, result.responseId, result.replyId], uid }),
    method: "gemini-web",
    conversationId: result.conversationId,
    responseId: result.responseId,
  };
}
