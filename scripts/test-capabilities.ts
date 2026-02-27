/**
 * Test script for Saturn capabilities
 *
 * Run against local server before deploying to production.
 *
 * Usage:
 *   1. Start local server: npm run dev
 *   2. Run tests: npx tsx scripts/test-capabilities.ts
 *
 * Environment:
 *   SATURN_TEST_URL - Server URL (default: http://localhost:8000)
 *   SATURN_TEST_KEY - Agent API key (required)
 */

const BASE_URL = process.env.SATURN_TEST_URL || 'http://localhost:8000';
const API_KEY = process.env.SATURN_TEST_KEY;

if (!API_KEY) {
  console.error('❌ SATURN_TEST_KEY environment variable required');
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error, duration: Date.now() - start });
    console.log(`  ✗ ${name}: ${error}`);
  }
}

async function post(path: string, body: unknown): Promise<{ status: number; data: unknown; headers: Headers }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data, headers: res.headers };
}

async function get(path: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  const data = await res.json() as { status: string };
  if (data.status !== 'ok') throw new Error(`Health check failed: ${JSON.stringify(data)}`);
}

async function testWallet() {
  const { status, data } = await get('/v1/wallet');
  if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`);
  const wallet = data as { balanceUsdCents: number };
  if (typeof wallet.balanceUsdCents !== 'number') throw new Error('Missing balanceUsdCents');
}

async function testSearch() {
  const { status, data, headers } = await post('/v1/capabilities/search', {
    query: 'test query'
  });
  if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`);

  const result = data as { results?: unknown[] };
  if (!Array.isArray(result.results)) throw new Error('Missing results array');

  const chargedCents = headers.get('X-Saturn-Charged-Usd-Cents');
  if (!chargedCents) throw new Error('Missing X-Saturn-Charged-Usd-Cents header');
}

async function testReason() {
  const { status, data, headers } = await post('/v1/capabilities/reason', {
    prompt: 'Say "test passed" and nothing else.'
  });
  if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`);

  const result = data as { content?: string };
  if (typeof result.content !== 'string') throw new Error('Missing content string');

  const chargedCents = headers.get('X-Saturn-Charged-Usd-Cents');
  if (!chargedCents) throw new Error('Missing X-Saturn-Charged-Usd-Cents header');
}

async function testRead() {
  const { status, data } = await post('/v1/capabilities/read', {
    url: 'https://example.com'
  });
  if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`);

  const result = data as { content?: string };
  if (typeof result.content !== 'string') throw new Error('Missing content string');
}

async function testImagine() {
  const { status, data, headers } = await post('/v1/capabilities/imagine', {
    prompt: 'A simple blue square on white background'
  });
  if (status !== 200) throw new Error(`Status ${status}: ${JSON.stringify(data)}`);

  const result = data as { url?: string };
  if (typeof result.url !== 'string') throw new Error('Missing url string');

  const chargedCents = headers.get('X-Saturn-Charged-Usd-Cents');
  if (!chargedCents) throw new Error('Missing X-Saturn-Charged-Usd-Cents header');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🪐 Saturn Capability Tests\n`);
  console.log(`Server: ${BASE_URL}\n`);

  console.log('Core:');
  await test('Health check', testHealth);
  await test('Wallet endpoint', testWallet);

  console.log('\nCapabilities:');
  await test('search - query transformation', testSearch);
  await test('reason - LLM inference', testReason);
  await test('read - URL content extraction', testRead);
  // Uncomment to test (costs ~$0.04):
  // await test('imagine - image generation', testImagine);

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '─'.repeat(40));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
    console.log();
    process.exit(1);
  }

  console.log('✅ All tests passed! Safe to deploy.\n');
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
