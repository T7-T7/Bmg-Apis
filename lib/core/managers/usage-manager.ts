export type UsageCompletion = Readonly<{
  usageId: number | null;
  complete: () => Promise<unknown>;
  onError: (cause: unknown) => void;
}>;

export async function completeUsageTracking({
  usageId,
  complete,
  onError,
}: UsageCompletion): Promise<void> {
  if (!usageId) return;
  try {
    await complete();
  } catch (cause) {
    onError(cause);
  }
}
