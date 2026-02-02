# @saturn-pay/sdk

TypeScript SDK for the Saturn API — Lightning-powered payments for AI agents.

## Install

```bash
npm install @saturn-pay/sdk
```

## Quick Start

```typescript
import { Saturn } from '@saturn-pay/sdk';

// Sign up and get an authenticated client
const { saturn, apiKey } = await Saturn.signup({
  name: 'my-agent',
  baseUrl: 'https://api.saturn-pay.com',
});

// Fund the agent wallet (returns a Lightning invoice)
const invoice = await saturn.wallet.fund({ amountSats: 10000 });
console.log('Pay this invoice:', invoice.paymentRequest);

// Use capabilities
const result = await saturn.reason({
  prompt: 'Explain quantum computing in one sentence',
});

console.log(result.data.content);
console.log(`Charged: ${result.metadata.chargedSats} sats`);
```

## Authentication

Every SDK instance requires an API key. You can get one by signing up:

```typescript
const { saturn, apiKey } = await Saturn.signup({ name: 'my-agent' });
// Save apiKey — it's only shown once
```

Or use an existing key:

```typescript
const saturn = new Saturn({ apiKey: 'sk_agt_...' });
```

## Capabilities

Saturn exposes AI services as capabilities — abstract verbs that route to the best available provider.

| Method | Description |
|--------|-------------|
| `saturn.reason()` | LLM inference (OpenAI, Anthropic) |
| `saturn.search()` | Web search (Serper, Brave) |
| `saturn.read()` | URL to clean text (Jina) |
| `saturn.scrape()` | Web scraping (Firecrawl, ScraperAPI) |
| `saturn.execute()` | Code execution (E2B) |
| `saturn.email()` | Send email (Resend) |
| `saturn.sms()` | Send SMS (Twilio) |
| `saturn.imagine()` | Image generation (Replicate) |
| `saturn.speak()` | Text-to-speech (ElevenLabs) |
| `saturn.transcribe()` | Speech-to-text (Deepgram) |

Each capability returns `{ data, metadata }` where `metadata` contains `chargedSats`, `quotedSats`, `balanceAfter`, and `auditId`.

## Direct Service Calls

For services not yet mapped to a capability, use the proxy:

```typescript
const result = await saturn.call<MyResponseType>('openai', {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## Resource Management

```typescript
// Wallet
const wallet = await saturn.wallet.get();
const invoices = await saturn.wallet.invoices();
const transactions = await saturn.wallet.transactions();

// Agents
const agents = await saturn.agents.list();
const agent = await saturn.agents.create({ name: 'worker-1' });

// Policies
const policy = await saturn.policies.get(agentId);
await saturn.policies.update(agentId, {
  maxPerCallSats: 500,
  maxPerDaySats: 5000,
  allowedCapabilities: ['reason', 'search'],
});

// Services catalog
const services = await saturn.services.list();
const capabilities = await saturn.capabilities.list();
```

## Error Handling

```typescript
import { SaturnPolicyDeniedError, SaturnInsufficientBalanceError } from '@saturn-pay/sdk';

try {
  await saturn.reason({ prompt: 'hello' });
} catch (err) {
  if (err instanceof SaturnPolicyDeniedError) {
    console.log('Policy blocked this call:', err.message);
  } else if (err instanceof SaturnInsufficientBalanceError) {
    console.log('Need more sats — fund the wallet');
  }
}
```

## License

MIT
