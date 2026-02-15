/**
 * E2E Tests: Full User Journey
 * Tests the complete user lifecycle from signup to API usage.
 *
 * This test file demonstrates the full Saturn experience:
 * 1. User signs up with email/password
 * 2. User logs in and validates auth
 * 3. User creates a worker agent
 * 4. User configures agent policy
 * 5. User funds account via Stripe
 * 6. User makes API calls
 * 7. User reviews transaction history
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Saturn } from '../../sdk/src/index.js';
import {
  E2E_CONFIG,
  generateTestEmail,
  generateTestPassword,
  login,
  getAuthMe,
  sleep,
} from './setup.js';

describe('Full User Journey', () => {
  // Test state that persists across tests
  const testState: {
    email: string;
    password: string;
    name: string;
    apiKey?: string;
    agentId?: string;
    accountId?: string;
    jwtToken?: string;
    saturn?: Saturn;
    workerAgentId?: string;
    workerApiKey?: string;
  } = {
    email: generateTestEmail(),
    password: generateTestPassword(),
    name: `E2E Journey ${Date.now()}`,
  };

  describe('1. Account Creation', () => {
    it('should sign up with email and password', async () => {
      const res = await fetch(`${E2E_CONFIG.apiUrl}/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testState.name,
          email: testState.email,
          password: testState.password,
        }),
      });

      expect(res.ok).toBe(true);
      const data = await res.json();

      testState.apiKey = data.apiKey;
      testState.agentId = data.agentId;
      testState.accountId = data.accountId;

      expect(testState.apiKey).toMatch(/^sk_agt_/);
      expect(testState.agentId).toMatch(/^agt_/);
      expect(testState.accountId).toMatch(/^acc_/);
    });

    it('should initialize SDK with API key', () => {
      testState.saturn = new Saturn({
        apiKey: testState.apiKey!,
        baseUrl: E2E_CONFIG.apiUrl,
      });

      expect(testState.saturn).toBeDefined();
    });
  });

  describe('2. Authentication', () => {
    it('should login with credentials and receive JWT', async () => {
      const result = await login(testState.email, testState.password);

      testState.jwtToken = result.token;

      expect(result.token).toBeDefined();
      expect(result.accountId).toBe(testState.accountId);
      expect(result.email).toBe(testState.email);
    });

    it('should validate JWT with /auth/me', async () => {
      const me = await getAuthMe(testState.jwtToken!);

      expect(me.accountId).toBe(testState.accountId);
      expect(me.email).toBe(testState.email);
    });

    it('should get account info with API key', async () => {
      const account = await testState.saturn!.accounts.me();

      expect(account.id).toBe(testState.accountId);
      expect(account.email).toBe(testState.email);
      expect(account.name).toBe(testState.name);
    });
  });

  describe('3. Wallet Setup', () => {
    it('should have empty wallet initially', async () => {
      const wallet = await testState.saturn!.wallet.getSelf();

      expect(wallet.balanceSats).toBe(0);
      expect(wallet.balanceUsdCents).toBe(0);
      expect(wallet.accountId).toBe(testState.accountId);
    });

    it('should create Stripe checkout session', async () => {
      const result = await testState.saturn!.wallet.fundCardSelf({
        amountUsdCents: 500,
      });

      expect(result.checkoutUrl).toMatch(/stripe\.com/);
      expect(result.amountUsdCents).toBe(500);
      expect(result.amountSats).toBeGreaterThan(0);

      console.log('\n--- Stripe Checkout URL ---');
      console.log(result.checkoutUrl);
      console.log('Test card: 4242 4242 4242 4242');
      console.log('---------------------------\n');
    });
  });

  describe('4. Worker Agent Creation', () => {
    it('should create a worker agent', async () => {
      const agent = await testState.saturn!.agents.create({
        name: 'E2E Worker',
        metadata: {
          purpose: 'e2e-testing',
          createdBy: 'full-flow-test',
        },
      });

      testState.workerAgentId = agent.id;
      testState.workerApiKey = agent.apiKey;

      expect(agent.id).toMatch(/^agt_/);
      expect(agent.apiKey).toMatch(/^sk_agt_/);
      expect(agent.status).toBe('active');
      expect(agent.policy).toBeDefined();
    });

    it('should verify worker shares account wallet', async () => {
      const workerSaturn = new Saturn({
        apiKey: testState.workerApiKey!,
        baseUrl: E2E_CONFIG.apiUrl,
      });

      const primaryWallet = await testState.saturn!.wallet.getSelf();
      const workerWallet = await workerSaturn.wallet.getSelf();

      expect(workerWallet.id).toBe(primaryWallet.id);
    });
  });

  describe('5. Policy Configuration', () => {
    it('should get default policy', async () => {
      const policy = await testState.saturn!.agents.policy.get(
        testState.workerAgentId!
      );

      expect(policy.agentId).toBe(testState.workerAgentId);
      expect(policy.killSwitch).toBe(false);
    });

    it('should set spend limits', async () => {
      const policy = await testState.saturn!.agents.policy.update(
        testState.workerAgentId!,
        {
          maxPerCallSats: 10000, // 10k sats per call
          maxPerDaySats: 100000, // 100k sats per day
        }
      );

      expect(policy.maxPerCallSats).toBe(10000);
      expect(policy.maxPerDaySats).toBe(100000);
    });

    it('should restrict capabilities', async () => {
      const policy = await testState.saturn!.agents.policy.update(
        testState.workerAgentId!,
        {
          allowedCapabilities: ['reason', 'search', 'read'],
          deniedCapabilities: ['email', 'sms'],
        }
      );

      expect(policy.allowedCapabilities).toContain('reason');
      expect(policy.allowedCapabilities).toContain('search');
      expect(policy.deniedCapabilities).toContain('email');
    });

    it('should test kill switch toggle', async () => {
      // Enable kill switch
      let policy = await testState.saturn!.agents.policy.kill(
        testState.workerAgentId!
      );
      expect(policy.killSwitch).toBe(true);

      // Disable kill switch
      policy = await testState.saturn!.agents.policy.unkill(
        testState.workerAgentId!
      );
      expect(policy.killSwitch).toBe(false);
    });
  });

  describe('6. Service Discovery', () => {
    it('should list all available services', async () => {
      const services = await testState.saturn!.services.list();

      expect(services.length).toBeGreaterThan(0);

      // Log available services
      console.log('\n--- Available Services ---');
      services.slice(0, 5).forEach((s) => {
        console.log(`  ${s.slug}: ${s.name}`);
      });
      if (services.length > 5) {
        console.log(`  ... and ${services.length - 5} more`);
      }
      console.log('--------------------------\n');
    });

    it('should list all available capabilities', async () => {
      const capabilities = await testState.saturn!.capabilities.list();

      expect(capabilities.length).toBeGreaterThan(0);

      // Log available capabilities
      console.log('\n--- Available Capabilities ---');
      capabilities.forEach((c) => {
        console.log(`  ${c.capability}: ${c.defaultProvider}`);
      });
      console.log('------------------------------\n');
    });
  });

  describe('7. API Calls (Unfunded)', () => {
    it('should reject calls with insufficient balance', async () => {
      await expect(
        testState.saturn!.read({ url: 'https://example.com' })
      ).rejects.toThrow(/Insufficient balance/);
    });
  });

  describe('8. Cleanup & Summary', () => {
    it('should list all agents created', async () => {
      const agents = await testState.saturn!.agents.list();

      console.log('\n--- Test Account Summary ---');
      console.log(`Account ID: ${testState.accountId}`);
      console.log(`Email: ${testState.email}`);
      console.log(`API Key: ${testState.apiKey}`);
      console.log(`Agents: ${agents.length}`);
      agents.forEach((a) => {
        console.log(`  - ${a.name} (${a.id}): ${a.status}`);
      });
      console.log('----------------------------\n');

      expect(agents.length).toBeGreaterThanOrEqual(2); // Primary + worker
    });

    it('should verify final wallet state', async () => {
      const wallet = await testState.saturn!.wallet.getSelf();

      console.log('\n--- Final Wallet State ---');
      console.log(`Wallet ID: ${wallet.id}`);
      console.log(`Balance (sats): ${wallet.balanceSats}`);
      console.log(`Balance (USD cents): ${wallet.balanceUsdCents}`);
      console.log(`Lifetime In (sats): ${wallet.lifetimeIn}`);
      console.log(`Lifetime In (USD cents): ${wallet.lifetimeInUsdCents}`);
      console.log('--------------------------\n');

      expect(wallet.id).toMatch(/^wal_/);
    });
  });
});

describe('Complete Funded Journey', () => {
  // This test suite requires manual funding or pre-funded account
  // It's marked as skip by default

  describe.skip('Funded API Flow', () => {
    it('should complete full funded workflow', async () => {
      // This would be the full funded flow:
      // 1. Create account
      // 2. Fund via Stripe (automated with Playwright)
      // 3. Wait for balance
      // 4. Make API calls
      // 5. Verify receipts
      // 6. Check audit logs

      console.log('This test requires Playwright automation for Stripe checkout');
    });
  });
});
