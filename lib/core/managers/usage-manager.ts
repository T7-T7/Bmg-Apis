export type UsageCompletion = Readonly<{
  usageId: number | null;
  complete: () => Promise<unknown>;
  onError: (cause: unknown) => void;
}>;

const COMPLETION_ATTEMPTS = 3;

export async function completeUsageTracking({
  usageId,
  complete,
  onError,
}: UsageCompletion): Promise<void> {
  if (!usageId) return;

  let lastError: unknown;
  for (let attempt = 0; attempt < COMPLETION_ATTEMPTS; attempt += 1) {
    try {
      const result = await complete();
      if (
        result !== null &&
        typeof result === "object" &&
        "completed" in result &&
        result.completed !== true
      ) {
        const reason = "reason" in result ? String(result.reason) : "not_confirmed";
        throw new Error(`Usage completion was not confirmed: ${reason}`);
      }
      return;
    } catch (cause) {
      lastError = cause;
      if (attempt + 1 < COMPLETION_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
      }
    }
  }

  onError(lastError);
}
