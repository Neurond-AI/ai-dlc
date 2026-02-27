// Exponential backoff retry utility

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff.
 * Delays: baseDelay * 2^0, baseDelay * 2^1, baseDelay * 2^2, ...
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, onRetry } = options;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay for a given retry attempt (0-indexed).
 * Returns milliseconds: 1000, 2000, 4000
 */
export function getBackoffDelay(retryCount: number, baseDelay = 1000): number {
  return baseDelay * Math.pow(2, retryCount);
}
