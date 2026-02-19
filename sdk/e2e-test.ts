/**
 * Saturn SDK E2E Test - Launch Day
 * Tests all 7 active capabilities
 *
 * Run: SATURN_API_KEY=xxx npx tsx e2e-test.ts
 */

import { Saturn } from './src/index.js';

const API_KEY = process.env.SATURN_API_KEY;
const BASE_URL = process.env.SATURN_BASE_URL || 'https://api.saturn-pay.com';

if (!API_KEY) {
  console.error('SATURN_API_KEY environment variable is required');
  process.exit(1);
}

const saturn = new Saturn({
  apiKey: API_KEY,
  baseUrl: BASE_URL,
});

interface TestResult {
  capability: string;
  success: boolean;
  costSats: number;
  latencyMs: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<{ chargedSats: number }>) {
  const start = Date.now();
  try {
    const { chargedSats } = await fn();
    const latency = Date.now() - start;
    console.log(`✅ ${name} (${latency}ms, ${chargedSats} sats)`);
    results.push({ capability: name, success: true, costSats: chargedSats, latencyMs: latency });
  } catch (err) {
    const latency = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`❌ ${name} - ${message}`);
    results.push({ capability: name, success: false, costSats: 0, latencyMs: latency, error: message });
  }
}

async function main() {
  console.log('\n🚀 Saturn SDK E2E Test - Launch Day\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('─'.repeat(50));

  // 1. REASON (OpenAI)
  await test('reason', async () => {
    const res = await saturn.reason({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Saturn works!" in exactly 2 words.' }],
      max_tokens: 10,
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // 2. SEARCH (Serper)
  await test('search', async () => {
    const res = await saturn.search({
      q: 'bitcoin price today',
      num: 3,
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // 3. READ (Jina)
  await test('read', async () => {
    const res = await saturn.read({
      url: 'https://example.com',
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // 4. SCRAPE (Firecrawl)
  await test('scrape', async () => {
    const res = await saturn.scrape({
      url: 'https://example.com',
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // 5. IMAGINE (Replicate)
  await test('imagine', async () => {
    const res = await saturn.imagine({
      prompt: 'A small orange Saturn planet, minimal, white background',
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // 6. SPEAK (ElevenLabs)
  await test('speak', async () => {
    const res = await saturn.speak({
      text: 'Saturn is live!',
      voice_id: '21m00Tcm4TlvDq8ikWAM', // Rachel
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // 7. TRANSCRIBE (Deepgram)
  await test('transcribe', async () => {
    const res = await saturn.transcribe({
      url: 'https://download.samplelib.com/mp3/sample-3s.mp3',
    });
    return { chargedSats: res.metadata.chargedSats };
  });

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Summary\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalCost = results.reduce((sum, r) => sum + r.costSats, 0);

  console.log(`Passed: ${passed}/7`);
  console.log(`Failed: ${failed}/7`);
  console.log(`Total cost: ${totalCost} sats (~$${(totalCost * 0.001).toFixed(4)} USD)`);

  if (failed === 0) {
    console.log('\n🎉 All capabilities working! Ready for launch.\n');
  } else {
    console.log('\n⚠️  Some capabilities failed. Check errors above.\n');
    process.exit(1);
  }
}

main().catch(console.error);
