export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found` : resource,
      'NOT_FOUND',
      404,
      id ? { resource, id } : undefined
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfterMs?: number) {
    super(message, 'RATE_LIMIT', 429, retryAfterMs ? { retryAfterMs } : undefined);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, originalError?: Error) {
    super(
      `${service} service error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { 
        service,
        ...(originalError ? { originalMessage: originalError.message } : {})
      }
    );
  }
}

export class PaymentError extends AppError {
  constructor(message: string, provider: string, details?: Record<string, any>) {
    super(message, 'PAYMENT_ERROR', 402, { provider, ...details });
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'BLOCKCHAIN_ERROR', 503, details);
  }
}

export class RideError extends AppError {
  constructor(message: string, rideId?: string, code: string = 'RIDE_ERROR') {
    super(message, code, 400, rideId ? { rideId } : undefined);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
