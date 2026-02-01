export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', id ? `${resource} '${id}' not found` : `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class PolicyDeniedError extends AppError {
  constructor(reason: string) {
    super(403, 'POLICY_DENIED', reason);
    this.name = 'PolicyDeniedError';
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(required: number, available: number) {
    super(402, 'INSUFFICIENT_BALANCE', `Insufficient balance: need ${required} sats, have ${available} sats`);
    this.name = 'InsufficientBalanceError';
  }
}

export class UpstreamError extends AppError {
  constructor(service: string, statusCode: number, message: string) {
    super(502, 'UPSTREAM_ERROR', `Upstream error from ${service} (${statusCode}): ${message}`);
    this.name = 'UpstreamError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Invalid or missing API key') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}
