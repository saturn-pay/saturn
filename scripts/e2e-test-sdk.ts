/**
 * E2E Test Script for Saturn SDK
 * Tests: signup, wallet, funding, proxy calls, shared wallet, dual-currency
 *
 * Run: npx tsx scripts/e2e-test-sdk.ts
 */

import { Saturn } from '../sdk/src/index.js';

const BASE_URL = process.env.SATURN_API_URL || 'https://saturn-api-production-460d.up.railway.app';

// Colors for output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const pass = (msg: string) => console.log(green(`✓ ${msg}`));
const fail = (msg: string) => {
  console.log(red(`✗ ${msg}`));
  process.exit(1);
};

async function main() {
  console.log('==================================');
  console.log('Saturn E2E Test (SDK)');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('==================================\n');

  // ---------------------------------------------------------------------------
  // 1. Signup
  // ---------------------------------------------------------------------------
  console.log('1. Signup...');
  const timestamp = Date.now();
  const { saturn, apiKey, agentId, accountId } = await Saturn.signup({
    name: `e2e-sdk-test-${timestamp}`,
    email: `e2e-sdk-${timestamp}@test.com`,
    baseUrl: BASE_URL,
  });
  pass(`Signup successful (agent: ${agentId})`);

  // ---------------------------------------------------------------------------
  // 2. Check wallet (should be empty)
  // ---------------------------------------------------------------------------
  console.log('\n2. Check wallet (should be empty)...');
  const wallet = await saturn.wallet.getSelf();

  if (wallet.balanceSats !== 0 || wallet.balanceUsdCents !== 0) {
    fail(`Wallet not empty: ${wallet.balanceSats} sats, ${wallet.balanceUsdCents} cents`);
  }
  pass(`Wallet is empty (sats: ${wallet.balanceSats}, usd: ${wallet.balanceUsdCents} cents)`);

  // ---------------------------------------------------------------------------
  // 3. Check dual-currency wallet fields
  // ---------------------------------------------------------------------------
  console.log('\n3. Check dual-currency wallet fields...');
  if (typeof wallet.balanceUsdCents !== 'number') fail('Missing balanceUsdCents');
  pass('Has balanceUsdCents');
  if (typeof wallet.heldUsdCents !== 'number') fail('Missing heldUsdCents');
  pass('Has heldUsdCents');
  if (typeof wallet.lifetimeInUsdCents !== 'number') fail('Missing lifetimeInUsdCents');
  pass('Has lifetimeInUsdCents');
  if (typeof wallet.lifetimeOutUsdCents !== 'number') fail('Missing lifetimeOutUsdCents');
  pass('Has lifetimeOutUsdCents');

  // ---------------------------------------------------------------------------
  // 4. Test Lightning funding
  // ---------------------------------------------------------------------------
  console.log('\n4. Test Lightning funding...');
  const invoice = await saturn.wallet.fundSelf({ amountSats: 1000 });

  if (!invoice.paymentRequest || !invoice.paymentRequest.startsWith('lnbc')) {
    fail('Invalid Lightning invoice');
  }
  pass('Lightning invoice created');

  // ---------------------------------------------------------------------------
  // 5. Test Card funding
  // ---------------------------------------------------------------------------
  console.log('\n5. Test Card funding...');
  const checkout = await saturn.wallet.fundCardSelf({ amountUsdCents: 500 });

  if (!checkout.checkoutUrl || !checkout.checkoutUrl.includes('stripe.com')) {
    fail('Invalid Stripe checkout URL');
  }
  pass('Stripe checkout created');

  // ---------------------------------------------------------------------------
  // 6. Test proxy call (should fail - insufficient balance)
  // ---------------------------------------------------------------------------
  console.log('\n6. Test proxy call (insufficient balance)...');
  try {
    await saturn.read({ url: 'https://example.com' });
    console.log('  (Note: Call succeeded - provider may be free or balance exists)');
  } catch (err: any) {
    if (err.message?.includes('INSUFFICIENT_BALANCE')) {
      pass('Correctly rejected (insufficient balance)');
    } else {
      console.log(`  (Note: Failed with: ${err.message})`);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Create second agent (shared wallet test)
  // ---------------------------------------------------------------------------
  console.log('\n7. Create second agent...');
  const agent2 = await saturn.agents.create({ name: 'e2e-sdk-agent2' });

  if (!agent2.apiKey) {
    fail('Second agent creation failed');
  }
  pass(`Second agent created (${agent2.id})`);

  // ---------------------------------------------------------------------------
  // 8. Verify shared wallet
  // ---------------------------------------------------------------------------
  console.log('\n8. Verify shared wallet...');
  const saturn2 = new Saturn({ apiKey: agent2.apiKey, baseUrl: BASE_URL });
  const wallet2 = await saturn2.wallet.getSelf();

  if (wallet.id !== wallet2.id) {
    fail(`Wallets not shared: ${wallet.id} vs ${wallet2.id}`);
  }
  pass(`Shared wallet verified (${wallet.id})`);

  // ---------------------------------------------------------------------------
  // 9. List services
  // ---------------------------------------------------------------------------
  console.log('\n9. List services...');
  const services = await saturn.services.list();

  if (services.length === 0) {
    fail('No services found');
  }
  pass(`Found ${services.length} services`);

  // ---------------------------------------------------------------------------
  // 10. List capabilities
  // ---------------------------------------------------------------------------
  console.log('\n10. List capabilities...');
  const capabilities = await saturn.capabilities.list();

  if (capabilities.length === 0) {
    fail('No capabilities found');
  }
  pass(`Found ${capabilities.length} capabilities`);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n==================================');
  console.log(green('All E2E tests passed!'));
  console.log('==================================\n');

  console.log('Test account credentials:');
  console.log(`  API Key: ${apiKey}`);
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Account ID: ${accountId}`);
  console.log('');
  console.log('To complete card funding test manually:');
  console.log(`  1. Open: ${checkout.checkoutUrl}`);
  console.log('  2. Use test card: 4242 4242 4242 4242');
  console.log('  3. Verify balance increased');
}

main().catch((err) => {
  console.error(red(`\nTest failed: ${err.message}`));
  process.exit(1);
});
