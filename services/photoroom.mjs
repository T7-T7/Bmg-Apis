import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';

const FIREBASE_API_KEY = 'AIzaSyAJGrgbFGB_-h8V2oJLr4b-_ipetqM0duU';
const FIREBASE_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
const SEGMENTATION_URL = 'https://segmentation-inference.photoroom.com/v1/upload';
const AI_STREAM_URL = 'https://ai-gateway.photoroom.com/v4/ai-tools/stream';
const ANDROID_PACKAGE = 'com.photoroom.app';
const ANDROID_CERT = '0424A4898A4B33940D8BF16E44251B876E97F8D0';
const APP_VERSION = '2026.45.02 (2618)';

let cachedToken = null;
let tokenExpiresAt = 0;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_STREAM_BYTES = 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_REDIRECTS = 3;

export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a === 255) return false;
    return true;
  }
  if (version === 6) {
    const value = address.toLowerCase().split('%')[0];
    if (value.startsWith('::') || value.startsWith('::ffff:')) return false;
    if (/^(fc|fd|fe[89ab]|ff)/.test(value)) return false;
    if (value.startsWith('2001:db8:') || value.startsWith('2001:2:') || value.startsWith('2001:10:') || value.startsWith('2001:20:') || value.startsWith('2002:')) return false;
    const [firstPart, secondPart] = value.split(':');
    const first = Number.parseInt(firstPart || '0', 16);
    const second = Number.parseInt(secondPart || '0', 16);
    if (first === 0x2001 && second <= 0x01ff) return false;
    return first >= 0x2000 && first <= 0x3fff;
  }
  return false;
}

export async function resolvePublicHttpsTarget(value, resolveHost = lookup) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Invalid image URL'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('Only public HTTPS image URLs are allowed');
  }
  if (url.port && url.port !== '443') throw new TypeError('Non-standard image ports are not allowed');
  const hostname = url.hostname.replace('[', '').replace(']', '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new TypeError('Private image hosts are not allowed');
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolveHost(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new TypeError('Image host resolves to a non-public network address');
  }
  return { url, hostname, address: addresses[0].address, family: addresses[0].family };
}

function requestBoundedHttps(target, headers, maxBytes) {
  return new Promise((resolve, reject) => {
    const { url, hostname, address, family } = target;
    const req = httpsRequest({
      protocol: 'https:', hostname, port: 443,
      path: `${url.pathname}${url.search}`, method: 'GET', family,
      headers, servername: isIP(hostname) ? undefined : hostname, rejectUnauthorized: true, agent: false,
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      lookup: (_host, options, callback) => options?.all
        ? callback(null, [{ address, family }])
        : callback(null, address, family)
    }, (res) => {
      const status = res.statusCode || 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        resolve({ status, location, headers: res.headers, buffer: Buffer.alloc(0) });
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        resolve({ status, headers: res.headers, buffer: Buffer.alloc(0) });
        return;
      }
      const contentLength = Number(res.headers['content-length'] || 0);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        res.destroy(new RangeError('Image exceeds the 4 MB limit'));
        reject(new RangeError('Image exceeds the 4 MB limit'));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          res.destroy(new RangeError('Image exceeds the 4 MB limit'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status, headers: res.headers, buffer: Buffer.concat(chunks, total) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function downloadPublicImage(value, { authorization } = {}) {
  let current = value;
  for (let redirects = 0; redirects <= MAX_IMAGE_REDIRECTS; redirects += 1) {
    const target = await resolvePublicHttpsTarget(current);
    const headers = { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' };
    const trustedPhotoRoomHost = target.hostname === 'photoroom.com' || target.hostname.endsWith('.photoroom.com');
    if (authorization && trustedPhotoRoomHost) headers.Authorization = authorization;
    const result = await requestBoundedHttps(target, headers, MAX_IMAGE_BYTES);
    if (result.location) {
      if (redirects === MAX_IMAGE_REDIRECTS) throw new Error('Too many image redirects');
      current = new URL(result.location, target.url).toString();
      continue;
    }
    if (result.status < 200 || result.status >= 300) throw new Error(`Image download failed: HTTP ${result.status}`);
    const contentType = String(result.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') throw new TypeError('Remote resource is not a supported raster image');
    return { buffer: result.buffer, contentType };
  }
  throw new Error('Image download failed');
}

async function readResponseTextBounded(response, maxBytes = MAX_STREAM_BYTES) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError('PhotoRoom response exceeded the stream size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, total).toString('utf8');
}

async function getFirebaseToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const res = await fetch(FIREBASE_SIGNUP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Android-Package': ANDROID_PACKAGE,
      'X-Android-Cert': ANDROID_CERT
    },
    body: JSON.stringify({ returnSecureToken: true })
  });

  if (!res.ok) {
    throw new Error(`Firebase anonymous auth failed (${res.status}).`);
  }

  const data = await res.json();
  cachedToken = data.idToken;
  tokenExpiresAt = now + (Number.parseInt(data.expiresIn, 10) - 300) * 1000;
  return cachedToken;
}

async function resolveInput(input) {
  if (Buffer.isBuffer(input) || input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const buffer = Buffer.from(input);
    if (buffer.length > MAX_IMAGE_BYTES) throw new RangeError('Input image exceeds the 4 MB limit');
    return buffer;
  }
  if (typeof input === 'string') {
    if (existsSync(input)) {
      const buffer = readFileSync(input);
      if (buffer.length > MAX_IMAGE_BYTES) throw new RangeError('Input image exceeds the 4 MB limit');
      return buffer;
    }
    if (input.startsWith('https://')) return (await downloadPublicImage(input)).buffer;
    throw new TypeError('Invalid input string (must be an existing file path or public HTTPS URL)');
  }
  throw new TypeError('Input must be a file path, URL, or Buffer');
}

function mergeAlpha(originalBuffer, maskBuffer) {
  const id = randomBytes(8).toString('hex');
  const origPath = join(tmpdir(), `pr_orig_${id}.bin`);
  const maskPath = join(tmpdir(), `pr_mask_${id}.bin`);
  const outPath = join(tmpdir(), `pr_out_${id}.png`);

  try {
    writeFileSync(origPath, originalBuffer);
    writeFileSync(maskPath, maskBuffer);

    const proc = spawnSync('ffmpeg', [
      '-loglevel', 'error', '-y',
      '-i', origPath,
      '-i', maskPath,
      '-filter_complex', '[1:v]format=gray[m];[0:v][m]alphamerge',
      '-c:v', 'png',
      outPath
    ]);

    if (proc.status !== 0 || !existsSync(outPath)) {
      const err = proc.stderr?.toString() || 'ffmpeg alphamerge failed';
      throw new Error(`Cutout composition failed: ${err}`);
    }
    const output = readFileSync(outPath);
    if (output.length > MAX_IMAGE_BYTES) throw new RangeError('Processed image exceeds the 4 MB limit');
    return output;
  } finally {
    if (existsSync(origPath)) unlinkSync(origPath);
    if (existsSync(maskPath)) unlinkSync(maskPath);
    if (existsSync(outPath)) unlinkSync(outPath);
  }
}

// ============ NEW: البحث recursively عن أي رابط صورة داخل أي JSON ============
function findImageUrl(obj, depth = 0) {
  if (depth > 12 || obj == null) return null;

  if (typeof obj === 'string') {
    if (/^https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?$/i.test(obj)) return obj;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findImageUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === 'object') {
    // أولوية للحقول الشائعة
    for (const k of ['url', 'imageUrl', 'image_url', 'resultUrl', 'result_url', 'outputUrl', 'output_url', 'assetUrl', 'fileUrl', 'href']) {
      if (typeof obj[k] === 'string' && /^https?:\/\//i.test(obj[k])) return obj[k];
    }
    // بحث عشوائي في باقي الحقول
    for (const k of Object.keys(obj)) {
      const found = findImageUrl(obj[k], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// ============ NEW: parser كامل لـ SSE events ============
function parseSSE(text) {
  const events = [];
  let cur = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('event:')) {
      cur = { event: line.slice(6).trim(), data: [] };
      events.push(cur);
    } else if (line.startsWith('data:')) {
      if (!cur) { cur = { event: 'message', data: [] }; events.push(cur); }
      cur.data.push(line.slice(5).trimStart());
    } else if (line === '') {
      // نهاية حدث، مش مهم هنا
    } else if (line.startsWith(':')) {
      // تعليق، تجاهل
    }
  }
  return events;
}

async function runAiTool(toolId, toolVersion, inputs, timeoutMs = 150000) {
  const idToken = await getFirebaseToken();
  const boundary = `----PhotoRoomBoundary${randomBytes(8).toString('hex')}`;
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="toolId"\r\n\r\n${toolId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="toolVersion"\r\n\r\n${toolVersion}\r\n`)
  ];

  for (const [key, val] of Object.entries(inputs)) {
    if (Buffer.isBuffer(val)) {
      const isPng = val[0] === 0x89 && val[1] === 0x50;
      const ext = isPng ? 'png' : 'jpg';
      const mime = isPng ? 'image/png' : 'image/jpeg';
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="image.${ext}"\r\nContent-Type: ${mime}\r\n\r\n`));
      parts.push(val);
      parts.push(Buffer.from('\r\n'));
    } else if (val !== undefined && val !== null) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(AI_STREAM_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'okhttp/4.12.0',
        'pr-app-version': APP_VERSION,
        Authorization: idToken,
        Accept: 'text/event-stream',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`PhotoRoom AI tool ${toolId} failed (${res.status}).`);
    }

    const text = await readResponseTextBounded(res);
    const events = parseSSE(text);

    let imageUrl = null;
    let imageId = null;
    let generationId = null;
    let lastEventType = null;
    let hasErrorEvent = false;

    for (const ev of events) {
      lastEventType = ev.event;
      const dataStr = ev.data.join('\n');
      if (!dataStr) continue;

      let parsed = null;
      try { parsed = JSON.parse(dataStr); } catch {}

      if (parsed) {
        if (parsed.generationId) generationId = parsed.generationId;

        if (/error|fail|reject/i.test(ev.event)) hasErrorEvent = true;

        const url = findImageUrl(parsed);
        if (url) {
          imageUrl = url;
          imageId = parsed.imageId || parsed.generationId || generationId;
          break;
        }
      }
    }

    // خطة بديلة: regex على النص الخام كله
    if (!imageUrl) {
      console.error('[Star X] Provider stream completed without an image URL.', {
        toolId, responseBytes: Buffer.byteLength(text), eventCount: events.length,
        lastEventType, hasGenerationId: Boolean(generationId), hasErrorEvent
      });
      throw new Error('PhotoRoom stream ended without a valid image URL.');
    }

    // تحميل الصورة
    const { buffer, contentType } = await downloadPublicImage(imageUrl, { authorization: idToken });

    return {
      status: true,
      toolId,
      imageId: imageId || generationId,
      imageUrl,
      buffer,
      size: buffer.length,
      contentType
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============ باقي الدوال بدون تغيير ============

export async function removeBg(input, options = {}) {
  const { modelType = 'autoPick', cutout = true } = options;
  if (!input) throw new TypeError('input is required');

  const [idToken, originalBuffer] = await Promise.all([
    getFirebaseToken(),
    resolveInput(input)
  ]);

  const boundary = `----PhotoRoomFormBoundary${randomBytes(8).toString('hex')}`;
  const headerPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="sourceImage"; filename="sourceImage.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
  );
  const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([headerPart, originalBuffer, footerPart]);

  const endpoint = `${SEGMENTATION_URL}?modelType=${encodeURIComponent(modelType)}&resizeMask=true`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'User-Agent': 'okhttp/4.12.0',
      'pr-app-version': APP_VERSION,
      Authorization: idToken,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    throw new Error(`PhotoRoom segmentation failed (${res.status}).`);
  }

  const resultText = await readResponseTextBounded(res, 6 * 1024 * 1024);
  const result = JSON.parse(resultText);
  if (!result.b64_mask) throw new Error('PhotoRoom returned no segmentation mask');

  const maskBuffer = Buffer.from(result.b64_mask, 'base64');
  if (maskBuffer.length > MAX_IMAGE_BYTES) throw new RangeError('Processed mask exceeds the 4 MB limit');
  let cutoutBuffer = null;
  if (cutout) {
    cutoutBuffer = mergeAlpha(originalBuffer, maskBuffer);
    if (cutoutBuffer.length > MAX_IMAGE_BYTES) throw new RangeError('Processed image exceeds the 4 MB limit');
  }

  return {
    status: true,
    cutoutBuffer,
    maskBuffer,
    size: cutoutBuffer ? cutoutBuffer.length : maskBuffer.length,
    label: result.label || null,
    openImageLabel: result.open_image_label || null,
    mainColors: result.main_colors || [],
    boundingBox: result.bounding_box || null,
    modelVersion: result.model_version || null,
    uncertaintyScore: result.uncertainty_score ?? null,
    contentType: 'image/png'
  };
}

export async function getMask(input, options = {}) {
  return removeBg(input, { ...options, cutout: false });
}

export async function aiScenes(input, prompt, options = {}) {
  if (!input) throw new TypeError('input is required');
  if (!prompt) throw new TypeError('prompt is required');
  const buf = await resolveInput(input);
  return runAiTool('tool:subject-edits', 6, {
    'requestInputs.userImage1': buf,
    'requestInputs.userPrompt1': prompt
  }, options.timeoutMs);
}

export async function aiShadows(input, options = {}) {
  if (!input) throw new TypeError('input is required');
  const buf = await resolveInput(input);
  return runAiTool('tool:ai-shadows', 1, {
    'requestInputs.image': buf
  }, options.timeoutMs);
}

export async function aiIroning(input, options = {}) {
  if (!input) throw new TypeError('input is required');
  const buf = await resolveInput(input);
  return runAiTool('tool:ironing', 4, {
    'requestInputs.imageFile': buf
  }, options.timeoutMs);
}

export async function text2image(prompt, options = {}) {
  if (!prompt) throw new TypeError('prompt is required');
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  return runAiTool('tool:v2-expert-pilot', 2, {
    'requestInputs.prompt': prompt,
    'requestInputs.seed': seed
  }, options.timeoutMs);
}

export async function aiBackground(input, prompt, options = {}) {
  if (!input) throw new TypeError('input is required');
  if (!prompt) throw new TypeError('prompt is required');
  const buf = await resolveInput(input);
  let maskBuf = options.mask;
  if (!maskBuf) {
    const seg = await removeBg(buf, { cutout: false });
    maskBuf = seg.maskBuffer;
  }
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  return runAiTool('tool:studio-prepared-background', 2, {
    'requestInputs.image': buf,
    'requestInputs.mask': maskBuf,
    'requestInputs.prompt': prompt,
    'requestInputs.seed': seed
  }, options.timeoutMs);
}
