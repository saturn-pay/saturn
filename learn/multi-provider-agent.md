# Multi-Provider Agent with Unified Budget

Build an agent that uses multiple AI providers while maintaining a single budget.

## What You'll Build

An agent that:
- Uses OpenAI for fast, cheap tasks
- Uses Anthropic for complex reasoning
- Falls back between providers on errors
- Tracks spend across all providers in one place
- Never exceeds your budget regardless of which provider handles the call

## Why This Matters

Without unified budgeting:

```
OpenAI account: $47.23 this month
Anthropic account: $89.12 this month
Google account: $23.45 this month
Total: $159.80 (discovered during invoice reconciliation)
```

With Saturn:

```
Saturn balance: $200.00
Spent today: $12.34 (across all providers)
Agent cap: $50/day
Status: Within budget
```

One number. One cap. Multiple providers.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Agent                             │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐   │
│  │   Fast    │  │  Complex  │  │      Fallback         │   │
│  │   Tasks   │  │  Reasoning│  │       Logic           │   │
│  │  (OpenAI) │  │(Anthropic)│  │   (Any available)     │   │
│  └─────┬─────┘  └─────┬─────┘  └───────────┬───────────┘   │
└────────┼──────────────┼────────────────────┼───────────────┘
         │              │                    │
         ▼              ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        Saturn                               │
│              Unified budget across providers                │
│         $50/day cap applies to ALL calls combined           │
└─────────────────────────────────────────────────────────────┘
         │              │                    │
         ▼              ▼                    ▼
    ┌────────┐    ┌──────────┐        ┌──────────┐
    │ OpenAI │    │Anthropic │        │  Google  │
    └────────┘    └──────────┘        └──────────┘
```

## Step-by-Step

### 1. Create Agent with Provider-Agnostic Caps

```typescript
import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({
  apiKey: process.env.SATURN_KEY,
});

// Caps apply across ALL providers
// maxPerCallUsdCents: 100  ($1.00 per call, any provider)
// maxPerDayUsdCents: 5000  ($50.00 per day, total)
```

### 2. Route by Task Type

```typescript
async function processTask(task: Task) {
  if (task.type === 'quick-classification') {
    // Fast, cheap model for simple tasks
    return await saturn.reason({
      prompt: task.prompt,
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
  }

  if (task.type === 'deep-analysis') {
    // Powerful model for complex reasoning
    return await saturn.reason({
      prompt: task.prompt,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  }

  // Default: let Saturn choose
  return await saturn.reason({ prompt: task.prompt });
}
```

### 3. Implement Fallback with Budget Awareness

```typescript
async function reliableReason(prompt: string) {
  const providers = ['anthropic', 'openai', 'google'];

  for (const provider of providers) {
    try {
      const result = await saturn.reason({ prompt, provider });

      console.log(`Success via ${provider}: $${(result.metadata.chargedUsdCents / 100).toFixed(2)}`);

      return result;

    } catch (err) {
      if (err.code === 'BUDGET_EXCEEDED') {
        // Don't try other providers - budget is budget
        console.log('Budget exhausted. Stopping.');
        throw err;
      }

      if (err.code === 'PROVIDER_UNAVAILABLE') {
        console.log(`${provider} unavailable, trying next...`);
        continue;
      }

      throw err;
    }
  }

  throw new Error('All providers failed');
}
```

### 4. Track Cross-Provider Spend

```typescript
async function runWorkload(tasks: Task[]) {
  let totalCost = 0;
  const providerCosts: Record<string, number> = {};

  for (const task of tasks) {
    try {
      const result = await processTask(task);
      const cost = result.metadata.chargedUsdCents;
      const provider = result.metadata.provider;

      totalCost += cost;
      providerCosts[provider] = (providerCosts[provider] || 0) + cost;

    } catch (err) {
      if (err.code === 'BUDGET_EXCEEDED') {
        console.log('Daily budget reached. Partial results available.');
        break;
      }
      throw err;
    }
  }

  console.log(`Total: $${(totalCost / 100).toFixed(2)}`);
  console.log('By provider:');
  for (const [provider, cost] of Object.entries(providerCosts)) {
    console.log(`  ${provider}: $${(cost / 100).toFixed(2)}`);
  }
}
```

## Failure Scenario: Fallback Storm

Without unified budgeting:

```
Primary (OpenAI) fails → Retry with Anthropic
Anthropic fails → Retry with Google
Google fails → Back to OpenAI
Loop continues...
Each "retry" costs money
No unified cap across providers
Wake up to $500 bill across 3 accounts
```

With Saturn:

```
Primary (OpenAI) fails → $0.15
Retry with Anthropic → $0.20
Retry with Google → $0.10
Loop continues...
After $50 total: BUDGET_EXCEEDED
All providers stopped
Damage: $50 (your cap)
```

## Where Financial Guardrails Matter

| Risk | Without Saturn | With Saturn |
|------|----------------|-------------|
| Fallback storm | Unbounded across providers | Single cap for all |
| Provider A outage | Traffic shifts, costs spike | Same budget applies |
| Cost comparison | Reconcile 3 invoices | One dashboard |
| Budget enforcement | Per-provider, manual | Automatic, unified |

## Production Checklist

- [ ] Agent created with unified caps
- [ ] Per-call cap prevents single expensive calls
- [ ] Daily cap limits total spend across providers
- [ ] Fallback logic respects BUDGET_EXCEEDED (doesn't retry)
- [ ] Provider metadata logged for cost analysis
- [ ] Circuit breaker prevents retry storms

## Extend This

- **Cost-aware routing**: Check remaining budget, route to cheaper provider when low
- **Provider preferences**: Weight by cost/latency/quality based on task
- **Spend alerts**: Notify when 80% of daily cap consumed
- **Provider analytics**: Compare cost/quality across providers over time
