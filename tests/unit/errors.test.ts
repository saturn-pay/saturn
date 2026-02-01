import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  PolicyDeniedError,
  InsufficientBalanceError,
  UpstreamError,
  AuthError,
  ValidationError,
} from '../../src/lib/errors.js';

describe('Error classes', () => {
  it('AppError has correct statusCode, code, and message', () => {
    const err = new AppError(500, 'INTERNAL', 'something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err.message).toBe('something broke');
    expect(err).toBeInstanceOf(Error);
  });

  it('NotFoundError is 404', () => {
    const err = new NotFoundError('Account', 'acct_123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('acct_123');
  });

  it('PolicyDeniedError is 403', () => {
    const err = new PolicyDeniedError('kill_switch_active');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('POLICY_DENIED');
    expect(err.message).toBe('kill_switch_active');
  });

  it('InsufficientBalanceError is 402', () => {
    const err = new InsufficientBalanceError(500, 100);
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe('INSUFFICIENT_BALANCE');
    expect(err.message).toContain('500');
    expect(err.message).toContain('100');
  });

  it('UpstreamError is 502', () => {
    const err = new UpstreamError('openai', 429, 'rate limited');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('UPSTREAM_ERROR');
    expect(err.message).toContain('openai');
  });

  it('AuthError is 401', () => {
    const err = new AuthError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ValidationError is 400', () => {
    const err = new ValidationError('bad input', { field: 'name' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ field: 'name' });
  });
});
