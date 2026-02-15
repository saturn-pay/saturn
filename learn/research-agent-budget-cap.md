# Research Agent with $5/Day Cap

Build an autonomous research agent with hard financial boundaries.

## What You'll Build

A research agent that:
- Searches the web for information
- Reads and extracts content from URLs
- Synthesizes findings with an LLM
- Operates within a strict $5/day budget
- Stops cleanly when budget is exhausted

## Why This Matters

Research agents iterate. They search, read, think, search again. Each iteration costs money. Without runtime enforcement:

```
Loop 1: search + read + reason = $0.15
Loop 2: search + read + reason = $0.18
Loop 3: search + read + reason = $0.12
...
Loop 847: You wake up to a $400 bill
```

Dashboards show you the damage. Saturn prevents it.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Research Agent                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │ Search  │──│  Read   │──│    Reason       │  │
│  │  Loop   │  │  URLs   │  │  (Synthesize)   │  │
│  └─────────┘  └─────────┘  └─────────────────┘  │
└─────────────────────────┬───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│                    Saturn                       │
│         $5/day cap • $0.50/call cap            │
│         Enforced before every call             │
└─────────────────────────────────────────────────┘
```

## Step-by-Step

### 1. Create the Agent with Caps

```typescript
import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({
  apiKey: process.env.SATURN_KEY,
});

// Verify caps are set (via dashboard or API)
// maxPerCallUsdCents: 50   ($0.50)
// maxPerDayUsdCents: 500   ($5.00)
```

### 2. Build the Research Loop

```typescript
async function research(topic: string, maxIterations = 10) {
  const findings: string[] = [];
  let totalCost = 0;

  for (let i = 0; i < maxIterations; i++) {
    try {
      // Search
      const searchResult = await saturn.search({
        query: `${topic} ${findings.length ? 'more details' : ''}`,
      });
      totalCost += searchResult.metadata.chargedUsdCents;

      // Read top result
      const url = searchResult.data.results[0]?.url;
      if (!url) break;

      const readResult = await saturn.read({ url });
      totalCost += readResult.metadata.chargedUsdCents;

      // Synthesize
      const reasonResult = await saturn.reason({
        prompt: `Given this content:\n${readResult.data.content}\n\nExtract key facts about: ${topic}`,
      });
      totalCost += reasonResult.metadata.chargedUsdCents;

      findings.push(reasonResult.data.content);

      console.log(`Iteration ${i + 1}: $${(totalCost / 100).toFixed(2)} spent`);

    } catch (err) {
      if (err.code === 'BUDGET_EXCEEDED') {
        console.log('Budget cap reached. Stopping research.');
        break;
      }
      throw err;
    }
  }

  return { findings, totalCost };
}
```

### 3. Handle Budget Exhaustion Gracefully

```typescript
const { findings, totalCost } = await research('quantum computing advances 2024');

console.log(`Research complete.`);
console.log(`Findings: ${findings.length}`);
console.log(`Total cost: $${(totalCost / 100).toFixed(2)}`);

// Even if budget exhausted mid-research, you have partial results
// The agent did not exceed $5. Guaranteed.
```

## Failure Scenario: The Infinite Loop

Without Saturn, this bug bankrupts you:

```typescript
// BUG: Forgot to increment or break
while (true) {
  await openai.chat.completions.create({ ... }); // $0.02 each
  // Runs 50,000 times before you notice = $1,000
}
```

With Saturn:

```typescript
while (true) {
  await saturn.reason({ ... }); // $0.02 each
  // Runs 250 times, then: BUDGET_EXCEEDED
  // Total damage: $5.00 (your cap)
}
```

## Where Financial Guardrails Matter

| Risk | Without Saturn | With Saturn |
|------|----------------|-------------|
| Infinite loop | Unbounded spend | Capped at $5/day |
| Expensive prompt | Single call can cost $10+ | Capped at $0.50/call |
| Bug in production | Discover on invoice | Discover immediately via rejection |
| Agent goes rogue | Hope you notice | Hard stop at boundary |

## Production Checklist

- [ ] Agent created with dedicated API key
- [ ] `maxPerCallUsdCents` set (prevents single expensive calls)
- [ ] `maxPerDayUsdCents` set (prevents runaway loops)
- [ ] Error handling catches `BUDGET_EXCEEDED`
- [ ] Partial results are usable (graceful degradation)
- [ ] Audit IDs logged for debugging
- [ ] Monitoring on daily spend approaching cap

## Extend This

- **Adaptive budgeting**: Start with tight caps, increase as agent proves reliable
- **Priority queuing**: When near cap, prioritize high-value research tasks
- **Cost estimation**: Estimate loop cost before starting, warn if likely to exceed
- **Multi-agent research**: Split budget across specialized agents (search agent, synthesis agent)
