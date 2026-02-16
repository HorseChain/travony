interface RetryOptions {
  maxAttempts?: number;
  backoffFactor?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxAttempts = 3,
    backoffFactor = 2.0,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    retryableErrors = () => true,
    onRetry,
  } = options || {};

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxAttempts || !retryableErrors(error)) {
        throw error;
      }

      const delay = Math.min(
        initialDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs
      );

      if (onRetry) {
        onRetry(attempt, error);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  successThreshold?: number;
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private name: string;
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private successThreshold: number;

  constructor(options?: CircuitBreakerOptions) {
    this.name = options?.name || "CircuitBreaker";
    this.failureThreshold = options?.failureThreshold || 5;
    this.resetTimeoutMs = options?.resetTimeoutMs || 60000;
    this.successThreshold = options?.successThreshold || 2;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure >= this.resetTimeoutMs) {
        this.transitionTo("half_open");
      } else {
        throw new Error(
          `Circuit breaker "${this.name}" is OPEN. Retry in ${this.resetTimeoutMs - timeSinceLastFailure}ms`
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "half_open") {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.transitionTo("closed");
        }
      }

      return result;
    } catch (error: any) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === "half_open") {
        this.transitionTo("open");
        throw error;
      }

      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo("open");
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.transitionTo("closed");
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      console.log(
        `Circuit breaker "${this.name}" transition: ${this.state} -> ${newState}`
      );
      this.state = newState;

      if (newState === "closed") {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
      } else if (newState === "half_open") {
        this.successCount = 0;
      }
    }
  }
}

export const twilioBreaker = new CircuitBreaker({
  name: "twilio",
  failureThreshold: 3,
  resetTimeoutMs: 30000,
});

export const nowPaymentsBreaker = new CircuitBreaker({
  name: "nowpayments",
  failureThreshold: 3,
  resetTimeoutMs: 45000,
});

export const blockchainBreaker = new CircuitBreaker({
  name: "blockchain",
  failureThreshold: 5,
  resetTimeoutMs: 60000,
});

export const openaiBreaker = new CircuitBreaker({
  name: "openai",
  failureThreshold: 3,
  resetTimeoutMs: 30000,
});

export const smtpBreaker = new CircuitBreaker({
  name: "smtp",
  failureThreshold: 3,
  resetTimeoutMs: 60000,
});

export async function withResilience<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  retryOpts?: RetryOptions
): Promise<T> {
  return retry(
    () => breaker.call(fn),
    retryOpts
  );
}
