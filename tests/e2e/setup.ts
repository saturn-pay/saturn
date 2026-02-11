/**
 * E2E Test Setup & Helpers
 * Provides utilities for creating test accounts, funding, and waiting for balance updates.
 */

import { Saturn } from '../../sdk/src/index.js';
import type { Wallet, Policy } from '../../sdk/src/types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const E2E_CONFIG = {
  apiUrl: process.env.E2E_API_URL || 'https://api.saturn-pay.com',
  dashboardUrl: process.env.E2E_DASHBOARD_URL || 'https://app.saturn-pay.com',
  stripeTestSecretKey: process.env.STRIPE_TEST_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestAccount {
  saturn: Saturn;
  apiKey: string;
  agentId: string;
  accountId: string;
  email: string;
  password: string;
}

export interface SignupResult {
  saturn: Saturn;
  apiKey: string;
  agentId: string;
  accountId: string;
}

// ---------------------------------------------------------------------------
// Account Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique test email for this test run
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `e2e-${timestamp}-${random}@saturn-pay.com`;
}

/**
 * Generate a secure test password
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now()}!`;
}

/**
 * Sign up a new test account with email/password
 * Returns an authenticated Saturn SDK instance
 */
export async function createTestAccount(): Promise<TestAccount> {
  const email = generateTestEmail();
  const password = generateTestPassword();
  const name = `E2E Test ${Date.now()}`;

  const baseUrl = E2E_CONFIG.apiUrl;

  // Signup with email and password
  const res = await fetch(`${baseUrl}/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Signup failed: ${JSON.stringify(error)}`);
  }

  const data = await res.json() as { agentId: string; apiKey: string; accountId: string };

  const saturn = new Saturn({
    apiKey: data.apiKey,
    baseUrl,
  });

  return {
    saturn,
    apiKey: data.apiKey,
    agentId: data.agentId,
    accountId: data.accountId,
    email,
    password,
  };
}

/**
 * Login with email and password, returns JWT token
 */
export async function login(email: string, password: string): Promise<{
  token: string;
  accountId: string;
  agentId: string;
  name: string;
  email: string;
}> {
  const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Login failed: ${JSON.stringify(error)}`);
  }

  return res.json();
}

/**
 * Get current authenticated user info using JWT token
 */
export async function getAuthMe(token: string): Promise<{
  accountId: string;
  name: string;
  email: string;
  agentId: string;
}> {
  const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Auth me failed: ${JSON.stringify(error)}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Wallet Helpers
// ---------------------------------------------------------------------------

/**
 * Create a Stripe checkout session for funding
 * Returns the checkout URL that can be automated with Playwright
 */
export async function createCheckoutSession(saturn: Saturn, amountUsdCents: number): Promise<{
  checkoutUrl: string;
  checkoutSessionId: string;
}> {
  const result = await saturn.wallet.fundCardSelf({ amountUsdCents });
  return {
    checkoutUrl: result.checkoutUrl,
    checkoutSessionId: result.checkoutSessionId,
  };
}

/**
 * Wait for wallet balance to reach expected amount
 * Polls the wallet until balance >= expectedCents or timeout
 */
export async function waitForBalance(
  saturn: Saturn,
  expectedUsdCents: number,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<Wallet> {
  const { timeoutMs = 60000, pollIntervalMs = 2000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const wallet = await saturn.wallet.getSelf();
    if (wallet.balanceUsdCents >= expectedUsdCents) {
      return wallet;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timeout waiting for balance >= ${expectedUsdCents} cents`);
}

/**
 * Get current wallet balance
 */
export async function getBalance(saturn: Saturn): Promise<{
  balanceSats: number;
  balanceUsdCents: number;
}> {
  const wallet = await saturn.wallet.getSelf();
  return {
    balanceSats: wallet.balanceSats,
    balanceUsdCents: wallet.balanceUsdCents,
  };
}

// ---------------------------------------------------------------------------
// Policy Helpers
// ---------------------------------------------------------------------------

/**
 * Enable kill switch on an agent
 */
export async function enableKillSwitch(saturn: Saturn, agentId: string): Promise<Policy> {
  return saturn.agents.policy.kill(agentId);
}

/**
 * Disable kill switch on an agent
 */
export async function disableKillSwitch(saturn: Saturn, agentId: string): Promise<Policy> {
  return saturn.agents.policy.unkill(agentId);
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 1000, maxDelayMs = 10000 } = options;
  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * 2, maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Assert that an error was thrown with specific message
 */
export async function expectError(
  fn: () => Promise<unknown>,
  expectedMessage?: string | RegExp
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if ((error as Error).message === 'Expected function to throw an error') {
      throw error;
    }
    if (expectedMessage) {
      const message = (error as Error).message;
      if (typeof expectedMessage === 'string') {
        if (!message.includes(expectedMessage)) {
          throw new Error(`Expected error message to include "${expectedMessage}", got: ${message}`);
        }
      } else if (!expectedMessage.test(message)) {
        throw new Error(`Expected error message to match ${expectedMessage}, got: ${message}`);
      }
    }
    return error as Error;
  }
}
