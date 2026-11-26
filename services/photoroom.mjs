import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fetchRemoteImage, MAX_IMAGE_BYTES } from './safe-image-fetch.mjs';

const FIREBASE_API_KEY = 'AIzaSyAJGrgbFGB_-h8V2oJLr4b-_ipetqM0duU';
const FIREBASE_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
const SEGMENTATION_URL = 'https://segmentation-inference.photoroom.com/v1/upload';
const AI_STREAM_URL = 'https://ai-gateway.photoroom.com/v4/ai-tools/stream';
const ANDROID_PACKAGE = 'com.photoroom.app';
const ANDROID_CERT = '0424A4898A4B33940D8BF16E44251B876E97F8D0';
const APP_VERSION = '2026.45.02 (2618)';

let cachedToken = null;
let tokenExpiresAt = 0;

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
    const errText = await res.text();
    throw new Error(`Firebase anonymous auth failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedToken = data.idToken;
  tokenExpiresAt = now + (Number.parseInt(data.expiresIn, 10) - 300) * 1000;
  return cachedToken;
}

async function resolveInput(input) {
  let buffer;
  if (Buffer.isBuffer(input) || input instanceof Uint8Array || input instanceof ArrayBuffer) {
    buffer = Buffer.from(input);
  } else if (typeof input === 'string') {
    if (existsSync(input)) buffer = readFileSync(input);
    else if (input.startsWith('https://')) buffer = (await fetchRemoteImage(input)).buffer;
    else throw new TypeError('Invalid input string (must be existing file path or HTTPS URL)');
  } else {
    throw new TypeError('Input must be a file path, HTTPS URL, or Buffer');
  }
  if (buffer.length > MAX_IMAGE_BYTES) throw new RangeError('Input image exceeds the 4 MB limit.');
  return buffer;
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
    return readFileSync(outPath);
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
    if (Buffer.isBuffer(val) && val.length > MAX_IMAGE_BYTES) {
      throw new RangeError('Input image exceeds the 4 MB limit.');
    }
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
      const errText = await res.text();
      throw new Error(`PhotoRoom AI tool ${toolId} failed (${res.status}): ${errText}`);
    }

    const text = await res.text();
    const events = parseSSE(text);

    let imageUrl = null;
    let imageId = null;
    let generationId = null;
    let lastEventType = null;
    let lastEventData = null;
    let errorEvent = null;

    for (const ev of events) {
      lastEventType = ev.event;
      const dataStr = ev.data.join('\n');
      if (!dataStr) continue;

      let parsed = null;
      try { parsed = JSON.parse(dataStr); } catch {}

      if (parsed) {
        lastEventData = parsed;
        if (parsed.generationId) generationId = parsed.generationId;

        // لو فيه event اسمه error/failed
        if (/error|fail|reject/i.test(ev.event)) errorEvent = { event: ev.event, data: parsed };

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
      const m = text.match(/https?:\/\/[^\s"'<>\\]+\.(?:png|jpe?g|webp)(?:\?[^\s"'<>\\]*)?/i);
      if (m) {
        imageUrl = m[0];
        console.log(`[Fallback] رابط صورة من regex: ${imageUrl}`);
      }
    }

    if (!imageUrl) {
      // ============ طباعة الـ stream كامل للتشخيص ============
      console.error(`\n========== FULL STREAM (${toolId}) ==========`);
      console.error(`[length: ${text.length} chars, ${events.length} events]`);
      console.error(text);
      console.error(`========== END STREAM ==========`);
      console.error(`Last event: ${lastEventType}`);
      console.error(`Last data:  ${JSON.stringify(lastEventData)}`);
      if (generationId) console.error(`generationId: ${generationId}`);
      if (errorEvent) console.error(`Error event: ${JSON.stringify(errorEvent)}`);

      let hint = '';
      if (errorEvent) hint = ` — الأداة بعتت event فيه خطأ: ${JSON.stringify(errorEvent.data)}`;
      else if (generationId) hint = ` — الـ stream خلص بدون رابط صورة (generationId=${generationId})`;
      else hint = ' — مفيش حتى generationId في الـ stream';

      throw new Error(`PhotoRoom stream ended with no image URL${hint}`);
    }

    // Download through the SSRF-safe, size-limited image transport.
    const downloaded = await fetchRemoteImage(imageUrl, {
      'User-Agent': 'okhttp/4.12.0',
      Authorization: idToken
    });
    const { buffer, contentType } = downloaded;

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
    const errText = await res.text();
    throw new Error(`PhotoRoom segmentation failed (${res.status}): ${errText}`);
  }

  const result = await res.json();
  if (!result.b64_mask) throw new Error('PhotoRoom returned no segmentation mask');

  const maskBuffer = Buffer.from(result.b64_mask, 'base64');
  let cutoutBuffer = null;
  if (cutout) cutoutBuffer = mergeAlpha(originalBuffer, maskBuffer);

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
