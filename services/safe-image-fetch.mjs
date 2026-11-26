import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function isPublicIPv4(address) {
  const [a, b, c] = address.split(".").map(Number);
  if (![a, b, c].every(Number.isInteger)) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}
function isPublicIPv6(address) {
  const value = address.toLowerCase().split("%")[0];
  if (!value.startsWith("2") && !value.startsWith("3")) return false;
  const [first, second = "0"] = value.split(":");
  const firstGroup = Number.parseInt(first, 16);
  const secondGroup = Number.parseInt(second || "0", 16);
  if (firstGroup === 0x2001 && secondGroup <= 0x01ff) return false;
  if (value.startsWith("2001:db8:") || value.startsWith("2002:")) return false;
  return true;
}
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPublicIPv4(address);
  if (family === 6) return isPublicIPv6(address);
  return false;
}
export function validateRemoteImageUrl(value) {
  if (typeof value !== "string" || value.length > 4096) throw new TypeError("Image URL is invalid.");
  let url;
  try { url = new URL(value); } catch { throw new TypeError("Image URL is invalid."); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || (url.port && url.port !== "443")) {
    throw new TypeError("Only public HTTPS image URLs on port 443 are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new TypeError("Private network image URLs are not allowed.");
  }
  if (isIP(host)) throw new TypeError("IP-literal image URLs are not allowed; use a public hostname.");
  return url;
}
export function isTrustedPhotoRoomHost(value) {
  const url = validateRemoteImageUrl(value);
  const hostname = url.hostname.toLowerCase();
  return hostname === "photoroom.com" || hostname.endsWith(".photoroom.com");
}

async function resolvePublicAddress(hostname) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => !isPublicAddress(record.address))) {
    throw new Error("Image host resolves to a non-public network address.");
  }
  return records[0];
}
function requestOnce(url, headers, pinnedAddress) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET", headers, servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, pinnedAddress.address, pinnedAddress.family),
    }, (response) => {
      const status = response.statusCode || 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume(); resolve({ redirect: location }); return;
      }
      if (status < 200 || status >= 300) {
        response.resume(); reject(new Error(`Image download failed with HTTP ${status}.`)); return;
      }
      const declaredLength = Number(response.headers["content-length"] || 0);
      if (declaredLength > MAX_IMAGE_BYTES) {
        response.destroy(); reject(new Error("Image exceeds the 4 MB download limit.")); return;
      }
      const chunks = []; let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX_IMAGE_BYTES) {
          response.destroy(new Error("Image exceeds the 4 MB download limit."));
          request.destroy(new Error("Image exceeds the 4 MB download limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        buffer: Buffer.concat(chunks, total),
        contentType: String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase(),
      }));
      response.on("error", reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("Image download timed out.")));
    request.on("error", reject); request.end();
  });
}
function sniffImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6))) return "image/gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(buffer.toString("ascii", 8, 12))) return "image/avif";
  return null;
}
export async function fetchRemoteImage(value, headers = {}) {
  let currentUrl = validateRemoteImageUrl(value);
  let requestHeaders = { "User-Agent": "Nox-Secure-Image-Fetch/1.0", Accept: "image/*", ...headers };
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const pinnedAddress = await resolvePublicAddress(currentUrl.hostname);
    const result = await requestOnce(currentUrl, requestHeaders, pinnedAddress);
    if (result.redirect) {
      if (redirects === MAX_REDIRECTS) throw new Error("Image URL exceeded the redirect limit.");
      const nextUrl = validateRemoteImageUrl(new URL(result.redirect, currentUrl).toString());
      if (nextUrl.origin !== currentUrl.origin) {
        requestHeaders = Object.fromEntries(Object.entries(requestHeaders).filter(([key]) =>
          key.toLowerCase() !== "authorization" && key.toLowerCase() !== "cookie"));
      }
      currentUrl = nextUrl; continue;
    }
    const detectedType = sniffImageType(result.buffer);
    const contentType = ALLOWED_CONTENT_TYPES.has(result.contentType) ? result.contentType : detectedType;
    if (!detectedType || !contentType || detectedType !== contentType) throw new Error("Remote response is not a supported raster image.");
    return { buffer: result.buffer, contentType, size: result.buffer.length, url: currentUrl.toString() };
  }
  throw new Error("Image download failed.");
}
