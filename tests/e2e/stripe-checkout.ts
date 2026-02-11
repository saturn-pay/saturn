/**
 * Stripe Checkout Automation with Playwright
 *
 * This module provides helpers to automate Stripe Checkout payment flow
 * using Playwright. Use this to complete the funding flow in E2E tests.
 *
 * Usage:
 *   import { completeStripeCheckout } from './stripe-checkout';
 *   await completeStripeCheckout(checkoutUrl);
 *
 * Prerequisites:
 *   - Install Playwright: npm install @playwright/test
 *   - Install browsers: npx playwright install chromium
 */

import { chromium, type Browser, type Page } from '@playwright/test';

// Stripe test card numbers
export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficientFunds: '4000000000009995',
  threeDSecure: '4000002500003155',
};

export interface CheckoutOptions {
  cardNumber?: string;
  expiryDate?: string;
  cvc?: string;
  name?: string;
  country?: string;
  postalCode?: string;
  headless?: boolean;
  timeout?: number;
}

const DEFAULT_OPTIONS: CheckoutOptions = {
  cardNumber: STRIPE_TEST_CARDS.success,
  expiryDate: '12/30',
  cvc: '123',
  name: 'E2E Test User',
  country: 'US',
  postalCode: '94111',
  headless: true,
  timeout: 60000,
};

/**
 * Complete a Stripe Checkout session using Playwright
 *
 * @param checkoutUrl - The Stripe checkout URL from fund-card endpoint
 * @param options - Payment options including card details
 * @returns true if payment completed successfully
 */
export async function completeStripeCheckout(
  checkoutUrl: string,
  options: CheckoutOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: opts.headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to checkout
    await page.goto(checkoutUrl, { timeout: opts.timeout });

    // Wait for the payment form to load
    await page.waitForSelector('input[name="cardNumber"]', { timeout: opts.timeout });

    // Fill card number
    await page.fill('input[name="cardNumber"]', opts.cardNumber!);

    // Fill expiry date
    await page.fill('input[name="cardExpiry"]', opts.expiryDate!);

    // Fill CVC
    await page.fill('input[name="cardCvc"]', opts.cvc!);

    // Fill cardholder name if present
    const nameInput = await page.$('input[name="billingName"]');
    if (nameInput) {
      await nameInput.fill(opts.name!);
    }

    // Select country if dropdown exists
    const countrySelect = await page.$('select[name="billingCountry"]');
    if (countrySelect) {
      await countrySelect.selectOption(opts.country!);
    }

    // Fill postal code if present
    const postalInput = await page.$('input[name="billingPostalCode"]');
    if (postalInput) {
      await postalInput.fill(opts.postalCode!);
    }

    // Click the submit button
    const submitButton = await page.waitForSelector(
      'button[type="submit"], .SubmitButton',
      { timeout: opts.timeout }
    );
    await submitButton.click();

    // Wait for redirect (payment success) or error
    await Promise.race([
      page.waitForURL(/success|return|complete/i, { timeout: opts.timeout }),
      page.waitForSelector('.Error, [data-testid="error-message"]', { timeout: opts.timeout }),
    ]);

    // Check if we landed on success page
    const currentUrl = page.url();
    const isSuccess = /success|return|complete/i.test(currentUrl);

    if (!isSuccess) {
      const errorElement = await page.$('.Error, [data-testid="error-message"]');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`Payment failed: ${errorText}`);
      }
    }

    return isSuccess;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fund an account via Stripe checkout
 * Combines checkout session creation with Playwright automation
 */
export async function fundAccountViaStripe(
  saturn: { wallet: { fundCardSelf: (params: { amountUsdCents: number }) => Promise<{ checkoutUrl: string }> } },
  amountUsdCents: number,
  options: CheckoutOptions = {}
): Promise<boolean> {
  // Create checkout session
  const { checkoutUrl } = await saturn.wallet.fundCardSelf({ amountUsdCents });

  // Complete payment
  return completeStripeCheckout(checkoutUrl, options);
}

/**
 * Interactive checkout - opens browser in non-headless mode for manual completion
 * Useful for debugging or manual testing
 */
export async function interactiveCheckout(checkoutUrl: string): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(checkoutUrl);

  console.log('\n===========================================');
  console.log('Stripe Checkout opened in browser window');
  console.log('Complete the payment manually, then close the browser');
  console.log('Test card: 4242 4242 4242 4242');
  console.log('Expiry: Any future date | CVC: Any 3 digits');
  console.log('===========================================\n');

  // Wait for browser to close
  await new Promise<void>((resolve) => {
    browser.on('disconnected', resolve);
  });
}
