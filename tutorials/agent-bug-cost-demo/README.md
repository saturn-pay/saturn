# The $400 Bug

> Same bug. Different financial outcome.

This is a demo of how a subtle agent bug can drain your wallet overnight—and how [Saturn](https://saturn-pay.com) prevents it.

## The Story

You're a solo dev. You ship an agent that summarizes documents. It works great in testing.

You deploy Friday evening. You go to bed.

Your agent has a bug: it retries whenever the response "seems incomplete." The check is simple:

```typescript
function responseSeemsTruncated(response: string): boolean {
  return !response.trim().endsWith('.') || response.length < 100;
}
```

The problem? Many valid responses don't end with a period:
- Lists
- Code blocks
- JSON
- Bullet points

Your agent retries. And retries. And retries.

You wake up Saturday morning to a **$400 invoice** from your LLM provider.

**This happens more often than you think.**

## The Demo

This repo contains two versions of the same buggy agent:

### 1. Unsafe Mode (no protection)

```bash
npm run unsafe
```

Watch costs accumulate as the bug triggers retry after retry. The simulation caps at 50 calls, but in production, this runs until:
- You notice and kill the process
- Your API quota is exhausted
- Your credit card is maxed

### 2. Saturn Mode (with protection)

```bash
npm run saturn
```

Same bug. Same retries. But now Saturn is watching.

When your daily spend limit is hit:
```
════════════════════════════════════════════════════════════
  SATURN PROTECTION ACTIVATED
════════════════════════════════════════════════════════════
  REJECTED: Policy limit reached
  Reason: daily_limit_exceeded

  Total API calls before rejection: 12
  Total cost: $0.36

  The bug was caught. Your wallet is safe.
```

## Setup

1. Clone this repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
4. Add your Saturn API key (get one at [saturn-pay.com](https://saturn-pay.com))

## Run the Demo

Interactive mode (choose unsafe/saturn/both):
```bash
npm run demo
```

Or run each mode directly:
```bash
npm run unsafe   # See the damage
npm run saturn   # See the protection
```

## How Saturn Prevents This

Saturn sits between your agent and the LLM provider. Every call goes through Saturn's policy layer:

```
Agent → Saturn → Provider
          ↓
    Policy Check:
    ✓ Per-call limit
    ✓ Daily limit
    ✓ Balance check
    ✓ Allowed capabilities
          ↓
    Allow or Reject
```

When you create an agent in Saturn, you set spend limits:

```typescript
await saturn.agents.policy.update(agentId, {
  maxPerCallUsdCents: 25,     // Max $0.25 per call
  maxPerDayUsdCents: 100,     // Max $1.00 per day
});
```

When the limit is hit, Saturn rejects the call immediately. Your agent gets a clear error. Your wallet stays safe.

## The Bug in This Demo

The bug is intentionally realistic. Many production agents have similar issues:

```typescript
// The flawed check
function responseSeemsTruncated(response: string): boolean {
  const endsWithPunctuation = /[.!?]$/.test(response.trim());
  const isTooShort = response.length < 100;

  // This triggers on ~60% of valid responses
  return !endsWithPunctuation || isTooShort;
}
```

This catches:
- "1. map()\n2. filter()\n3. reduce()" — valid list, no ending period
- "Here's the code:\n```js\nconsole.log('hi')\n```" — code block
- "Yes" — short but complete answer

Each false positive = another API call = more money burned.

## Why This Matters

| Scenario | Without Saturn | With Saturn |
|----------|----------------|-------------|
| Bug runs overnight | $400+ invoice | $1.00 max (your cap) |
| You notice the bug | When the bill arrives | Immediately (logs) |
| Recovery | Dispute with provider | Already protected |

## Learn More

- [Saturn Docs](https://saturn-pay.com/docs)
- [API Reference](https://saturn-pay.com/api)
- [Get Started](https://saturn-pay.com)

---

**This is how you wake up to a surprise invoice.**

Or, you use Saturn, and you don't.
