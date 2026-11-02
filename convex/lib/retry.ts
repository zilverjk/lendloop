export const MAX_DELIVERY_ATTEMPTS = 5;

/** Delay before the next attempt, given the number of attempts made so far (>=1). */
export function backoffMs(attemptsSoFar: number): number {
  return Math.min(5_000 * 2 ** (attemptsSoFar - 1), 10 * 60_000);
}

export function shouldRetry(attemptsSoFar: number): boolean {
  return attemptsSoFar < MAX_DELIVERY_ATTEMPTS;
}
