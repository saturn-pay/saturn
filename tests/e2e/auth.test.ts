/**
 * E2E Tests: Authentication Flow
 * Tests signup, login, and auth validation endpoints.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Saturn } from '../../sdk/src/index.js';
import {
  E2E_CONFIG,
  createTestAccount,
  login,
  getAuthMe,
  generateTestEmail,
  generateTestPassword,
  type TestAccount,
} from './setup.js';

describe('Auth Flow', () => {
  let testAccount: TestAccount;

  beforeAll(async () => {
    // Create a test account for auth tests
    testAccount = await createTestAccount();
  }, 30000);

  describe('Signup', () => {
    it('should create a new account with email/password', async () => {
      const email = generateTestEmail();
      const password = generateTestPassword();
      const name = `Signup Test ${Date.now()}`;

      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();

      expect(data.apiKey).toBeDefined();
      expect(data.apiKey).toMatch(/^sk_agt_/);
      expect(data.agentId).toBeDefined();
      expect(data.agentId).toMatch(/^agt_/);
      expect(data.accountId).toBeDefined();
      expect(data.accountId).toMatch(/^acc_/);
    });

    it('should reject signup with invalid email', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          email: 'invalid-email',
          password: generateTestPassword(),
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
    });

    it('should reject signup with short password', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          email: generateTestEmail(),
          password: 'short',
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
    });

    it('should reject duplicate email signup', async () => {
      // First signup
      const email = generateTestEmail();
      const password = generateTestPassword();

      const firstRes = await fetch(`${E2E_CONFIG.apiUrl}/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'First', email, password }),
      });
      expect(firstRes.ok).toBe(true);

      // Second signup with same email
      const secondRes = await fetch(`${E2E_CONFIG.apiUrl}/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Second', email, password }),
      });
      expect(secondRes.ok).toBe(false);
      expect(secondRes.status).toBe(400);
    });
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const result = await login(testAccount.email, testAccount.password);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
      expect(result.accountId).toBe(testAccount.accountId);
      expect(result.agentId).toBe(testAccount.agentId);
      expect(result.email).toBe(testAccount.email);
    });

    it('should reject login with wrong password', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testAccount.email,
          password: 'wrongpassword123!',
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });

    it('should reject login with non-existent email', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: generateTestPassword(),
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });
  });

  describe('Auth Validation', () => {
    it('should validate JWT token with /auth/me', async () => {
      const loginResult = await login(testAccount.email, testAccount.password);
      const me = await getAuthMe(loginResult.token);

      expect(me.accountId).toBe(testAccount.accountId);
      expect(me.agentId).toBe(testAccount.agentId);
      expect(me.email).toBe(testAccount.email);
      expect(me.name).toBeDefined();
    });

    it('should reject invalid JWT token', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/auth/me`, {
        headers: { Authorization: 'Bearer invalid.jwt.token' },
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });

    it('should reject missing authorization header', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/auth/me`);

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });
  });

  describe('Account Info', () => {
    it('should get account info with API key via /accounts/me', async () => {
      const account = await testAccount.saturn.accounts.me();

      expect(account.id).toBe(testAccount.accountId);
      expect(account.email).toBe(testAccount.email);
      expect(account.name).toBeDefined();
      expect(account.createdAt).toBeDefined();
    });

    it('should reject invalid API key', async () => {
      const badSaturn = new Saturn({
        apiKey: 'sk_agt_invalid_key_123',
        baseUrl: E2E_CONFIG.apiUrl,
      });

      await expect(badSaturn.accounts.me()).rejects.toThrow();
    });
  });
});
