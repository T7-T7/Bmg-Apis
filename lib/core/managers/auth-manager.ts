import { createHmac } from "node:crypto";

export type ApiKeyAuthorization = Readonly<{ valid: boolean; token: string | null }>;

export function parseApiKeyAuthorization(header: string): ApiKeyAuthorization {
  if (!header) return Object.freeze({ valid: true, token: null });
  const match = header.match(/^Bearer\s+((?:nox_[A-Za-z0-9_-]{52}|nox_live_[A-Za-z0-9_-]+|bmg_live_[A-Za-z0-9_-]+))$/i);
  return match
    ? Object.freeze({ valid: true, token: match[1] })
    : Object.freeze({ valid: false, token: null });
}

export function createDemoClientHash(request: Request, secret: string | undefined, errorMessage: string): string {
  if (!secret || secret.length < 32) throw new Error(errorMessage);
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex");
}
