/**
 * E2E Tests: Capabilities (Real API Calls)
 * Tests saturn.reason(), saturn.search(), saturn.read() with real API calls.
 *
 * NOTE: These tests require a funded account to work. They will be skipped
 * if the account has insufficient balance.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Saturn } from '../../sdk/src/index.js';
import {
  E2E_CONFIG,
  createTestAccount,
  type TestAccount,
} from './setup.js';

describe('Capabilities (Real API Calls)', () => {
  let testAccount: TestAccount;
  let hasFunds = false;

  beforeAll(async () => {
    testAccount = await createTestAccount();

    // Check if account has funds
    const wallet = await testAccount.saturn.wallet.getSelf();
    hasFunds = wallet.balanceUsdCents > 100 || wallet.balanceSats > 1000;

    if (!hasFunds) {
      console.log('Account has no funds - capability tests will verify error handling only');
    }
  }, 30000);

  describe('Services & Capabilities Discovery', () => {
    it('should list available services', async () => {
      const services = await testAccount.saturn.services.list();

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);

      // Check service structure
      const service = services[0];
      expect(service.id).toBeDefined();
      expect(service.slug).toBeDefined();
      expect(service.name).toBeDefined();
      expect(service.status).toBeDefined();
      expect(service.pricing).toBeDefined();
    });

    it('should list available capabilities', async () => {
      const capabilities = await testAccount.saturn.capabilities.list();

      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);

      // Check common capabilities exist
      const capabilityNames = capabilities.map((c) => c.capability);
      expect(capabilityNames).toContain('reason');
      expect(capabilityNames).toContain('search');
      expect(capabilityNames).toContain('read');
    });

    it('should get capability details', async () => {
      const capability = await testAccount.saturn.capabilities.get('reason');

      expect(capability.capability).toBe('reason');
      expect(capability.description).toBeDefined();
      expect(capability.defaultProvider).toBeDefined();
      expect(Array.isArray(capability.providers)).toBe(true);
    });

    it('should get service pricing', async () => {
      const services = await testAccount.saturn.services.list();
      const service = services.find((s) => s.status === 'active');

      if (service) {
        const pricing = await testAccount.saturn.services.pricing(service.slug);

        expect(Array.isArray(pricing)).toBe(true);
        if (pricing.length > 0) {
          const price = pricing[0];
          expect(price.operation).toBeDefined();
          expect(typeof price.priceUsdMicros).toBe('number');
          expect(typeof price.priceSats).toBe('number');
          expect(price.unit).toBeDefined();
        }
      }
    });
  });

  describe('Capability Calls (Unfunded)', () => {
    it('should reject reason() with insufficient balance', async () => {
      if (hasFunds) return; // Skip if funded

      await expect(
        testAccount.saturn.reason({
          prompt: 'Say hello',
          maxTokens: 10,
        })
      ).rejects.toThrow(/Insufficient balance/);
    });

    it('should reject search() with insufficient balance', async () => {
      if (hasFunds) return; // Skip if funded

      await expect(
        testAccount.saturn.search({
          query: 'test query',
          numResults: 1,
        })
      ).rejects.toThrow(/Insufficient balance/);
    });

    it('should reject read() with insufficient balance', async () => {
      if (hasFunds) return; // Skip if funded

      await expect(
        testAccount.saturn.read({
          url: 'https://example.com',
        })
      ).rejects.toThrow(/Insufficient balance/);
    });
  });

  // These tests only run if the account has funds
  describe.skipIf(!hasFunds)('Capability Calls (Funded)', () => {
    it('should execute reason() and return normalized response', async () => {
      const result = await testAccount.saturn.reason({
        prompt: 'What is 2 + 2? Answer with just the number.',
        maxTokens: 10,
      });

      // Check response structure
      expect(result.data).toBeDefined();
      expect(result.data.content).toBeDefined();
      expect(typeof result.data.content).toBe('string');
      expect(result.data.model).toBeDefined();
      expect(result.data.usage).toBeDefined();
      expect(typeof result.data.usage.totalTokens).toBe('number');

      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.auditId).toBeDefined();
      expect(typeof result.metadata.chargedSats).toBe('number');
      expect(typeof result.metadata.balanceAfter).toBe('number');
    });

    it('should execute search() and return normalized response', async () => {
      const result = await testAccount.saturn.search({
        query: 'saturn pay bitcoin',
        numResults: 3,
      });

      // Check response structure
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data.results)).toBe(true);

      if (result.data.results.length > 0) {
        const firstResult = result.data.results[0];
        expect(firstResult.title).toBeDefined();
        expect(firstResult.url).toBeDefined();
        expect(firstResult.snippet).toBeDefined();
      }

      // Check metadata
      expect(result.metadata.auditId).toBeDefined();
      expect(typeof result.metadata.chargedSats).toBe('number');
    });

    it('should execute read() and return normalized response', async () => {
      const result = await testAccount.saturn.read({
        url: 'https://example.com',
      });

      // Check response structure
      expect(result.data).toBeDefined();
      expect(typeof result.data.content).toBe('string');
      expect(result.data.content.length).toBeGreaterThan(0);

      // Check metadata
      expect(result.metadata.auditId).toBeDefined();
      expect(typeof result.metadata.chargedSats).toBe('number');
    });

    it('should include X-Saturn headers in response metadata', async () => {
      const result = await testAccount.saturn.read({
        url: 'https://example.com',
      });

      expect(result.metadata.auditId).toMatch(/^aud_/);
      expect(result.metadata.quotedSats).toBeGreaterThanOrEqual(0);
      expect(result.metadata.chargedSats).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.balanceAfter).toBe('number');
    });

    it('should deduct balance after API call', async () => {
      const walletBefore = await testAccount.saturn.wallet.getSelf();

      await testAccount.saturn.read({
        url: 'https://example.com',
      });

      const walletAfter = await testAccount.saturn.wallet.getSelf();

      // Balance should have decreased (or stayed same if free provider)
      expect(walletAfter.balanceSats).toBeLessThanOrEqual(walletBefore.balanceSats);
    });
  });

  describe('Generic Proxy Call', () => {
    it('should reject call() with insufficient balance', async () => {
      if (hasFunds) return;

      await expect(
        testAccount.saturn.call('openai', {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        })
      ).rejects.toThrow(/Insufficient balance/);
    });

    describe.skipIf(!hasFunds)('Generic Proxy (Funded)', () => {
      it('should call OpenAI directly via proxy', async () => {
        const result = await testAccount.saturn.call<{
          choices: Array<{ message: { content: string } }>;
        }>('openai', {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say hi' }],
          max_tokens: 10,
        });

        expect(result.data).toBeDefined();
        expect(result.data.choices).toBeDefined();
        expect(result.data.choices[0].message.content).toBeDefined();
        expect(result.metadata.auditId).toBeDefined();
      });
    });
  });
});

describe('Receipt & Audit', () => {
  let testAccount: TestAccount;
  let hasFunds = false;

  beforeAll(async () => {
    testAccount = await createTestAccount();
    const wallet = await testAccount.saturn.wallet.getSelf();
    hasFunds = wallet.balanceUsdCents > 100 || wallet.balanceSats > 1000;
  }, 30000);

  describe.skipIf(!hasFunds)('Audit Log Verification', () => {
    it('should record API call in audit log', async () => {
      // Make an API call
      const result = await testAccount.saturn.read({
        url: 'https://example.com',
      });

      const auditId = result.metadata.auditId;
      expect(auditId).toBeDefined();

      // Note: Fetching audit logs requires admin access
      // For now, we just verify the audit ID was returned
      console.log('Audit ID for verification:', auditId);
    });

    it('should include correct metadata in response', async () => {
      const walletBefore = await testAccount.saturn.wallet.getSelf();

      const result = await testAccount.saturn.search({
        query: 'test',
        numResults: 1,
      });

      // Verify metadata structure
      expect(result.metadata).toMatchObject({
        auditId: expect.stringMatching(/^aud_/),
        quotedSats: expect.any(Number),
        chargedSats: expect.any(Number),
        balanceAfter: expect.any(Number),
      });

      // Balance after should match wallet
      const walletAfter = await testAccount.saturn.wallet.getSelf();
      expect(result.metadata.balanceAfter).toBe(walletAfter.balanceSats);
    });
  });

  describe('Transaction Recording', () => {
    it('should record transactions for funded account', async () => {
      if (!hasFunds) return;

      // Make a call to generate a transaction
      await testAccount.saturn.read({ url: 'https://example.com' });

      // Check transactions
      const transactions = await testAccount.saturn.wallet.transactionsSelf();

      expect(transactions.data.length).toBeGreaterThan(0);

      // Find a proxy call transaction
      const proxyTx = transactions.data.find(
        (tx) => tx.type === 'debit_proxy_call'
      );

      if (proxyTx) {
        expect(proxyTx.referenceType).toBe('proxy_call');
        expect(proxyTx.amountSats).toBeGreaterThanOrEqual(0);
        expect(proxyTx.description).toBeDefined();
      }
    });
  });
});
