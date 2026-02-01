export class SaturnError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'SaturnError';
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

export class SaturnAuthError extends SaturnError {
  constructor(message: string, details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
    this.name = 'SaturnAuthError';
  }
}

export class SaturnValidationError extends SaturnError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'SaturnValidationError';
  }
}

export class SaturnNotFoundError extends SaturnError {
  constructor(message: string, details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
    this.name = 'SaturnNotFoundError';
  }
}

export class SaturnPolicyDeniedError extends SaturnError {
  constructor(message: string, details?: unknown) {
    super(403, 'POLICY_DENIED', message, details);
    this.name = 'SaturnPolicyDeniedError';
  }
}

export class SaturnInsufficientBalanceError extends SaturnError {
  constructor(message: string, details?: unknown) {
    super(402, 'INSUFFICIENT_BALANCE', message, details);
    this.name = 'SaturnInsufficientBalanceError';
  }
}

export class SaturnUpstreamError extends SaturnError {
  constructor(message: string, status: number = 502, details?: unknown) {
    super(status, 'UPSTREAM_ERROR', message, details);
    this.name = 'SaturnUpstreamError';
  }
}

export class SaturnRateLimitError extends SaturnError {
  constructor(message: string, details?: unknown) {
    super(429, 'RATE_LIMIT', message, details);
    this.name = 'SaturnRateLimitError';
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export function fromResponse(status: number, body: ErrorBody): SaturnError {
  const code = body?.error?.code ?? 'UNKNOWN';
  const message = body?.error?.message ?? `Request failed with status ${status}`;
  const details = body?.error?.details;

  switch (code) {
    case 'UNAUTHORIZED':
      return new SaturnAuthError(message, details);
    case 'VALIDATION_ERROR':
      return new SaturnValidationError(message, details);
    case 'NOT_FOUND':
      return new SaturnNotFoundError(message, details);
    case 'POLICY_DENIED':
      return new SaturnPolicyDeniedError(message, details);
    case 'INSUFFICIENT_BALANCE':
      return new SaturnInsufficientBalanceError(message, details);
    case 'UPSTREAM_ERROR':
      return new SaturnUpstreamError(message, status, details);
    case 'RATE_LIMIT':
      return new SaturnRateLimitError(message, details);
    default:
      return new SaturnError(status, code, message, details);
  }
}
