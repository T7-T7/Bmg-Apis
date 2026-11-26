import test from "node:test";
import assert from "node:assert/strict";
import { PayloadTooLargeError, readJsonRequestBody } from "../lib/core/managers/request-manager.ts";

function requestWithStream(stream, headers = {}) {
  return new Request("https://nox.test/api", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  });
}

test("request manager parses valid JSON without changing its value", async () => {
  const request = new Request("https://nox.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "hello", count: 2 }),
  });

  assert.deepEqual(await readJsonRequestBody(request, 1024), { prompt: "hello", count: 2 });
});

test("request manager rejects declared content lengths above the byte limit before reading", async () => {
  let read = false;
  const stream = new ReadableStream({
    pull(controller) {
      read = true;
      controller.enqueue(new TextEncoder().encode("{}"));
      controller.close();
    },
  });
  const request = requestWithStream(stream, { "content-length": "9" });

  await assert.rejects(readJsonRequestBody(request, 8), PayloadTooLargeError);
  assert.equal(read, false);
});

test("request manager enforces the byte limit when content length is absent", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"too large"}'));
      controller.close();
    },
  });

  await assert.rejects(readJsonRequestBody(requestWithStream(stream), 8), PayloadTooLargeError);
});

test("request manager preserves the payload-too-large error when stream cancellation fails", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123456789"));
    },
    cancel() {
      throw new Error("stream cancellation failed");
    },
  });

  await assert.rejects(readJsonRequestBody(requestWithStream(stream), 8), PayloadTooLargeError);
});

test("request manager rejects malformed JSON and invalid UTF-8", async () => {
  const malformed = new Request("https://nox.test/api", { method: "POST", body: "{invalid" });
  const invalidUtf8 = new Request("https://nox.test/api", {
    method: "POST",
    body: new Uint8Array([0xc3, 0x28]),
  });

  await assert.rejects(readJsonRequestBody(malformed, 1024), SyntaxError);
  await assert.rejects(readJsonRequestBody(invalidUtf8, 1024), TypeError);
});

test("request manager rejects invalid byte limits", async () => {
  const request = new Request("https://nox.test/api", { method: "POST", body: "{}" });

  await assert.rejects(readJsonRequestBody(request, 0), RangeError);
  await assert.rejects(readJsonRequestBody(request, Number.MAX_SAFE_INTEGER + 1), RangeError);
});
