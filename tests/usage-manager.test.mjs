import test from "node:test";
import assert from "node:assert/strict";
import {
  completeManagedUsageTracking,
  completeUsageTracking,
} from "../lib/core/managers/usage-manager.ts";

test("usage manager skips completion when no usage record was created", async () => {
  let completionCalls = 0;
  let errorCalls = 0;

  await completeUsageTracking({
    usageId: null,
    complete: async () => {
      completionCalls += 1;
      return { completed: true };
    },
    onError: () => {
      errorCalls += 1;
    },
  });

  assert.equal(completionCalls, 0);
  assert.equal(errorCalls, 0);
});

test("usage manager accepts a confirmed completion without retrying", async () => {
  let completionCalls = 0;
  let reportedError;

  await completeUsageTracking({
    usageId: 41,
    complete: async () => {
      completionCalls += 1;
      return { completed: true };
    },
    onError: (cause) => {
      reportedError = cause;
    },
  });

  assert.equal(completionCalls, 1);
  assert.equal(reportedError, undefined);
});

test("usage manager retries transient failures and stops after confirmation", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const delays = [];
  let completionCalls = 0;
  let reportedError;

  globalThis.setTimeout = (callback, delay, ...args) => {
    delays.push(delay);
    return originalSetTimeout(callback, 0, ...args);
  };

  try {
    await completeUsageTracking({
      usageId: 42,
      complete: async () => {
        completionCalls += 1;
        if (completionCalls < 3) throw new Error("temporary database failure");
        return { completed: true };
      },
      onError: (cause) => {
        reportedError = cause;
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(completionCalls, 3);
  assert.deepEqual(delays, [150, 300]);
  assert.equal(reportedError, undefined);
});

test("usage manager reports the final error after three unconfirmed attempts", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const delays = [];
  const finalError = new Error("database unavailable");
  let completionCalls = 0;
  let reportedError;

  globalThis.setTimeout = (callback, delay, ...args) => {
    delays.push(delay);
    return originalSetTimeout(callback, 0, ...args);
  };

  try {
    await completeUsageTracking({
      usageId: 43,
      complete: async () => {
        completionCalls += 1;
        throw finalError;
      },
      onError: (cause) => {
        reportedError = cause;
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(completionCalls, 3);
  assert.deepEqual(delays, [150, 300]);
  assert.equal(reportedError, finalError);
});

test("usage manager retries invalid acknowledgements instead of treating them as success", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, _delay, ...args) =>
    originalSetTimeout(callback, 0, ...args);

  let completionCalls = 0;
  let reportedError;

  try {
    await completeUsageTracking({
      usageId: 44,
      complete: async () => {
        completionCalls += 1;
        return { completed: false, reason: "not_completed" };
      },
      onError: (cause) => {
        reportedError = cause;
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(completionCalls, 3);
  assert.ok(reportedError instanceof Error);
  assert.match(reportedError.message, /not_completed/);
});

test("managed usage completion sends the canonical RPC payload through its transport", async () => {
  const startedAt = Date.now() - 25;
  let receivedProcedure;
  let receivedArgs;

  await completeManagedUsageTracking({
    usageId: 45,
    statusCode: 200,
    startedAt,
    serverSecret: "test-server-secret",
    rpc: async (procedure, args) => {
      receivedProcedure = procedure;
      receivedArgs = args;
      return { data: { completed: true }, error: null };
    },
    onError: (cause) => {
      throw cause;
    },
  });

  assert.equal(receivedProcedure, "bmg_complete_api_request");
  assert.deepEqual(
    {
      p_usage_id: receivedArgs.p_usage_id,
      p_status_code: receivedArgs.p_status_code,
      p_server_secret: receivedArgs.p_server_secret,
    },
    {
      p_usage_id: 45,
      p_status_code: 200,
      p_server_secret: "test-server-secret",
    },
  );
  assert.ok(Number.isFinite(receivedArgs.p_latency_ms));
  assert.ok(receivedArgs.p_latency_ms >= 0);
});
