# Multi-Provider Model

Saturn routes calls to upstream providers while maintaining unified financial controls.

## Unified Budget Across Providers

An agent's budget applies regardless of which provider handles the call:

```
Agent daily cap: $10.00

Call 1: OpenAI    → $2.00 (daily: $2.00)
Call 2: Anthropic → $3.00 (daily: $5.00)
Call 3: OpenAI    → $4.00 (daily: $9.00)
Call 4: Anthropic → $2.00 → REJECTED (would exceed $10.00)
```

Credits are provider-agnostic. One pool, multiple providers.

## Provider Selection

Saturn selects providers based on:
1. Explicit `provider` parameter in call
2. Capability default (configured by Saturn)
3. Availability and routing rules

```typescript
// Use default provider
await saturn.reason({ prompt: '...' });

// Specify provider explicitly
await saturn.reason({ prompt: '...', provider: 'anthropic' });
```

## Fallback Implications

If you implement fallback logic:

```typescript
try {
  return await saturn.reason({ prompt, provider: 'openai' });
} catch (err) {
  if (err.code === 'PROVIDER_UNAVAILABLE') {
    return await saturn.reason({ prompt, provider: 'anthropic' });
  }
  throw err;
}
```

Both calls count against the same budget. A fallback storm (repeated failures + retries) can exhaust your budget quickly.

**Mitigations:**
- Set per-call caps to limit individual call cost
- Implement circuit breakers
- Monitor provider health before retrying
- Use Saturn's built-in routing when available

## Cross-Provider Receipts

Every receipt includes provider metadata:

```typescript
{
  auditId: "aud_...",
  provider: "anthropic",
  capability: "reason",
  chargedUsdCents: 45,
  // ...
}
```

This enables:
- Per-provider cost analysis
- Provider comparison
- Debugging routing decisions

## Cost Normalization

Saturn normalizes pricing across providers. You pay Saturn's rate, which includes:
- Upstream provider cost
- Saturn margin

This means:
- Predictable pricing regardless of provider
- No need to track multiple provider invoices
- Single reconciliation point
