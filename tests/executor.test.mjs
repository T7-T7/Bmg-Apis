import test from "node:test";
import assert from "node:assert/strict";
import { executeRequestPipeline } from "../lib/core/engine/executor.ts";

const service = Object.freeze({ slug: "aql-gemini", method: "POST" });

test("executor rejects an unsupported method without invoking the service handler", async () => {
  let handlerCalls = 0;
  let receivedRequestId;

  const response = await executeRequestPipeline({
    service,
    request: new Request("https://nox.test/api", { method: "GET" }),
    handler: async () => {
      handlerCalls += 1;
      return Response.json({ success: true });
    },
    managerName: "Nox Core",
    onMethodNotAllowed: (requestId) => {
      receivedRequestId = requestId;
      return Response.json({ success: false }, { status: 405 });
    },
    onFailure: () => Response.json({ success: false }, { status: 500 }),
  });

  assert.equal(response.status, 405);
  assert.equal(handlerCalls, 0);
  assert.match(receivedRequestId, /^[0-9a-f-]{36}$/i);
});

test("executor decorates successful responses without changing status or body", async () => {
  let context;

  const response = await executeRequestPipeline({
    service,
    request: new Request("https://nox.test/api", { method: "POST" }),
    handler: async (receivedContext) => {
      context = receivedContext;
      return Response.json({ success: true, value: 7 }, {
        status: 201,
        headers: { "X-Service-Header": "preserved" },
      });
    },
    managerName: "Nox Core",
    onMethodNotAllowed: () => Response.json({ success: false }, { status: 405 }),
    onFailure: () => Response.json({ success: false }, { status: 500 }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, value: 7 });
  assert.equal(response.headers.get("X-Service-Header"), "preserved");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Service-Manager"), "Nox Core");
  assert.equal(response.headers.get("X-Service-Slug"), "aql-gemini");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(response.headers.get("X-Request-Id") || "", /^[0-9a-f-]{36}$/i);
  assert.match(response.headers.get("Server-Timing") || "", /^service-execution;dur=\d+(?:\.\d+)?$/);
  assert.equal(context.serviceSlug, "aql-gemini");
  assert.equal(typeof context.startedAt, "number");
  assert.equal(context.requestId, response.headers.get("X-Request-Id"));
});

test("executor sends handler exceptions to the configured failure boundary", async () => {
  const failure = new Error("private upstream detail");
  let captured;

  const response = await executeRequestPipeline({
    service,
    request: new Request("https://nox.test/api", { method: "POST" }),
    handler: async () => {
      throw failure;
    },
    managerName: "Nox Core",
    onMethodNotAllowed: () => Response.json({ success: false }, { status: 405 }),
    onFailure: (requestId, durationMs, cause) => {
      captured = { requestId, durationMs, cause };
      return Response.json({ success: false, error: "generic failure" }, { status: 500 });
    },
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, error: "generic failure" });
  assert.equal(captured.cause, failure);
  assert.match(captured.requestId, /^[0-9a-f-]{36}$/i);
  assert.ok(captured.durationMs >= 0);
});
