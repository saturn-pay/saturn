# Budgets & Caps

## Definition

**Budgets** are spending limits enforced at the agent level. Saturn supports two cap types:

| Cap Type | Scope | Resets |
|----------|-------|--------|
| `maxPerCallUsdCents` | Single API call | Never (per-call) |
| `maxPerDayUsdCents` | 24-hour rolling window | Daily at midnight UTC |

Caps are independent of credit balance. An agent with $100 in credits but a $5/day cap cannot spend more than $5/day.

## Why It Exists

Credits answer: "How much money is available?"
Caps answer: "How much should this agent be allowed to spend?"

Without caps:
- A bug can drain your entire credit balance in seconds
- No economic boundaries between workloads
- Cost attribution becomes cost allocation after the fact

Caps create runtime enforcement. The call is rejected before it happens.

## Enforcement Behavior

Order of checks:
1. Is the agent active? (not killed)
2. Is the capability allowed?
3. Does quoted cost exceed `maxPerCallUsdCents`? → Reject
4. Does (today's spend + quoted cost) exceed `maxPerDayUsdCents`? → Reject
5. Does quoted cost exceed available credits? → Reject
6. All checks pass → Execute

```
Agent daily cap: $1.00
Today's spend: $0.95
Quoted cost: $0.10
Result: REJECTED (BudgetExceeded) — would exceed daily cap
```

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Setting caps too high | Caps become meaningless |
| Setting caps too low | Legitimate calls rejected |
| Forgetting per-call caps | Single expensive call drains daily budget |
| Not testing cap behavior | Surprise rejections in production |

## Example

```typescript
// Set policy via dashboard or API
await saturn.agents.updatePolicy(agentId, {
  maxPerCallUsdCents: 50,    // $0.50 max per call
  maxPerDayUsdCents: 500,    // $5.00 max per day
});

// Calls exceeding caps are rejected before execution
try {
  await saturn.reason({ prompt: veryLongPrompt });
} catch (err) {
  if (err.code === 'BUDGET_EXCEEDED') {
    console.log('Call would exceed cap:', err.message);
  }
}
```
