import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createDemoClientHash,
  parseApiKeyAuthorization,
} from "../lib/core/managers/auth-manager.ts";
import { authorizeManagedRequest } from "../lib/core/managers/authorization-manager.ts";

test("API key parser accepts the supported bearer prefixes", () => {
  for (const token of ["nox_live_abc123", "bmg_live_abc_123-XYZ"]) {
    const result = parseApiKeyAuthorization("Bearer " + token);
    assert.deepEqual(result, { valid: true, token });
  }
});

test("API key parser treats an absent authorization header as a demo candidate", () => {
  assert.deepEqual(parseApiKeyAuthorization(""), { valid: true, token: null });
});

test("API key parser rejects malformed or unsupported authorization schemes", () => {
  for (const header of [
    "Basic abc",
    "Bearer invalid_prefix_123",
    "Bearer nox_live_",
    "Bearer nox_live_token extra",
    "Bearer",
    "bearer nox_live_token with-space",
  ]) {
    assert.deepEqual(parseApiKeyAuthorization(header), { valid: false, token: null }, header);
  }
});

test("demo client hash uses the trusted Vercel forwarded address and remains deterministic", () => {
  const request = new Request("https://nox.test", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-forwarded-for": "198.51.100.20",
    },
  });
  const secret = "a-test-secret-that-is-at-least-32-characters";
  const expected = createHmac("sha256", secret).update("203.0.113.10").digest("hex");

  assert.equal(createDemoClientHash(request, secret, "missing secret"), expected);
  assert.equal(createDemoClientHash(request, secret, "missing secret"), expected);
});

test("demo client hash falls back to the standard forwarded address", () => {
  const request = new Request("https://nox.test", {
    headers: { "x-forwarded-for": "198.51.100.20, 10.0.0.2" },
  });
  const secret = "a-test-secret-that-is-at-least-32-characters";
  const expected = createHmac("sha256", secret).update("198.51.100.20").digest("hex");

  assert.equal(createDemoClientHash(request, secret, "missing secret"), expected);
});

test("demo client hash rejects missing or weak secrets", () => {
  const request = new Request("https://nox.test");
  assert.throws(() => createDemoClientHash(request, undefined, "secret missing"), /secret missing/);
  assert.throws(() => createDemoClientHash(request, "short", "secret weak"), /secret weak/);
});

test("authorization manager calls the API-key RPC with the canonical server arguments", async () => {
  let call;
  const result = await authorizeManagedRequest({
    rpc: async (procedure, args) => {
      call = { procedure, args };
      return { data: { authorized: true, usage_id: 123 }, error: null };
    },
    serviceSlug: "star-x",
    token: "nox_live_test",
    clientHash: () => {
      throw new Error("demo hash must not be requested for API-key authorization");
    },
    serverSecret: "server-secret",
  });

  assert.equal(call.procedure, "bmg_authorize_api_request");
  assert.deepEqual(call.args, {
    p_key: "nox_live_test",
    p_service_slug: "star-x",
    p_method: "POST",
    p_server_secret: "server-secret",
  });
  assert.deepEqual(result, { authorized: true, usageId: 123, reason: undefined, message: undefined });
  assert.ok(Object.isFrozen(result));
});

test("authorization manager calls the Demo RPC with the client fingerprint", async () => {
  let call;
  let hashCalls = 0;
  const result = await authorizeManagedRequest({
    rpc: async (procedure, args) => {
      call = { procedure, args };
      return { data: { authorized: false, reason: "rate_limited", message: "Limit reached" }, error: null };
    },
    serviceSlug: "gptfree",
    token: null,
    clientHash: () => {
      hashCalls += 1;
      return "client-hash";
    },
    serverSecret: "server-secret",
  });

  assert.equal(hashCalls, 1);
  assert.equal(call.procedure, "bmg_authorize_demo_request");
  assert.deepEqual(call.args, {
    p_client_hash: "client-hash",
    p_service_slug: "gptfree",
    p_method: "POST",
    p_server_secret: "server-secret",
  });
  assert.deepEqual(result, {
    authorized: false,
    usageId: null,
    reason: "rate_limited",
    message: "Limit reached",
  });
});

test("authorization manager propagates RPC transport errors", async () => {
  const failure = new Error("RPC transport failed");
  await assert.rejects(
    authorizeManagedRequest({
      rpc: async () => ({ data: null, error: failure }),
      serviceSlug: "aql-gemini",
      token: "bmg_live_test",
      clientHash: () => "unused",
      serverSecret: "server-secret",
    }),
    (cause) => cause === failure,
  );
});

test("authorization manager fails closed for malformed or non-authorized RPC data", async () => {
  for (const data of [null, "invalid", {}, { authorized: 1, usage_id: 9 }]) {
    const result = await authorizeManagedRequest({
      rpc: async () => ({ data, error: null }),
      serviceSlug: "aql-gemini",
      token: "nox_live_test",
      clientHash: () => "unused",
      serverSecret: "server-secret",
    });
    assert.equal(result.authorized, false);
    assert.equal(result.usageId, null);
  }
});
