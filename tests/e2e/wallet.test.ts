/**
 * E2E Tests: Wallet & Funding
 * Tests Stripe checkout session creation, payment flow, and balance updates.
 *
 * NOTE: The actual Stripe payment completion requires Playwright automation
 * or manual testing. This test suite validates the checkout flow setup.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  E2E_CONFIG,
  createTestAccount,
  createCheckoutSession,
  waitForBalance,
  type TestAccount,
} from './setup.js';

describe('Wallet & Funding', () => {
  let testAccount: TestAccount;

  beforeAll(async () => {
    testAccount = await createTestAccount();
  }, 30000);

  describe('Wallet State', () => {
    it('should have empty wallet after signup', async () => {
      const wallet = await testAccount.saturn.wallet.getSelf();

      expect(wallet.balanceSats).toBe(0);
      expect(wallet.balanceUsdCents).toBe(0);
      expect(wallet.heldSats).toBe(0);
      expect(wallet.heldUsdCents).toBe(0);
    });

    it('should have dual-currency wallet fields', async () => {
      const wallet = await testAccount.saturn.wallet.getSelf();

      // Sats fields
      expect(typeof wallet.balanceSats).toBe('number');
      expect(typeof wallet.heldSats).toBe('number');
      expect(typeof wallet.lifetimeIn).toBe('number');
      expect(typeof wallet.lifetimeOut).toBe('number');

      // USD fields
      expect(typeof wallet.balanceUsdCents).toBe('number');
      expect(typeof wallet.heldUsdCents).toBe('number');
      expect(typeof wallet.lifetimeInUsdCents).toBe('number');
      expect(typeof wallet.lifetimeOutUsdCents).toBe('number');

      // Metadata
      expect(wallet.id).toMatch(/^wal_/);
      expect(wallet.accountId).toBe(testAccount.accountId);
      expect(wallet.createdAt).toBeDefined();
    });
  });

  describe('Stripe Funding', () => {
    it('should create Stripe checkout session', async () => {
      const amountUsdCents = 500; // $5.00
      const { checkoutUrl, checkoutSessionId } = await createCheckoutSession(
        testAccount.saturn,
        amountUsdCents
      );

      expect(checkoutUrl).toBeDefined();
      expect(checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com/);
      expect(checkoutSessionId).toBeDefined();
      expect(checkoutSessionId).toMatch(/^cs_/);
    });

    it('should include BTC rate info in checkout response', async () => {
      const result = await testAccount.saturn.wallet.fundCardSelf({ amountUsdCents: 1000 });

      expect(result.checkoutUrl).toBeDefined();
      expect(result.checkoutSessionId).toBeDefined();
      expect(result.amountUsdCents).toBe(1000);
      expect(result.amountSats).toBeGreaterThan(0);
      expect(result.btcUsdRate).toBeGreaterThan(0);
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject checkout with zero amount', async () => {
      await expect(
        testAccount.saturn.wallet.fundCardSelf({ amountUsdCents: 0 })
      ).rejects.toThrow();
    });

    it('should reject checkout with negative amount', async () => {
      await expect(
        testAccount.saturn.wallet.fundCardSelf({ amountUsdCents: -100 })
      ).rejects.toThrow();
    });
  });

  describe('Lightning Funding', () => {
    it('should create Lightning invoice', async () => {
      const amountSats = 1000;
      const invoice = await testAccount.saturn.wallet.fundSelf({ amountSats });

      expect(invoice.paymentRequest).toBeDefined();
      expect(invoice.paymentRequest).toMatch(/^lnbc/);
      expect(invoice.invoiceId).toBeDefined();
      expect(invoice.amountSats).toBe(amountSats);
      expect(invoice.expiresAt).toBeDefined();
    });

    it('should reject invoice with zero amount', async () => {
      await expect(
        testAccount.saturn.wallet.fundSelf({ amountSats: 0 })
      ).rejects.toThrow();
    });
  });

  describe('Transaction History', () => {
    it('should return empty transactions for new account', async () => {
      const result = await testAccount.saturn.wallet.transactionsSelf();

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.limit).toBeGreaterThan(0);
      expect(typeof result.offset).toBe('number');
    });
  });

  describe('Invoice History', () => {
    it('should track pending invoices', async () => {
      // Create an invoice first
      await testAccount.saturn.wallet.fundSelf({ amountSats: 500 });

      const invoices = await testAccount.saturn.wallet.invoicesSelf();

      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices.length).toBeGreaterThan(0);

      const invoice = invoices[0];
      expect(invoice.id).toBeDefined();
      expect(invoice.status).toBe('pending');
      expect(invoice.amountSats).toBe(500);
    });
  });

  // NOTE: This test requires Playwright to complete the payment flow
  // or a pre-funded account. Skip in automated runs unless funding is available.
  describe.skip('Payment Completion (requires Playwright)', () => {
    it('should credit wallet after Stripe payment', async () => {
      const amountUsdCents = 500;
      const { checkoutUrl } = await createCheckoutSession(
        testAccount.saturn,
        amountUsdCents
      );

      // TODO: Use Playwright to:
      // 1. Navigate to checkoutUrl
      // 2. Fill in test card: 4242 4242 4242 4242
      // 3. Complete payment
      // 4. Wait for redirect

      console.log('Complete payment at:', checkoutUrl);
      console.log('Test card: 4242 4242 4242 4242');

      // Wait for webhook to credit wallet
      const wallet = await waitForBalance(testAccount.saturn, amountUsdCents, {
        timeoutMs: 60000,
        pollIntervalMs: 2000,
      });

      expect(wallet.balanceUsdCents).toBeGreaterThanOrEqual(amountUsdCents);
    });
  });
});
