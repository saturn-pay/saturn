# Multi-Tenant SaaS Copilot

Build a copilot where each customer has isolated, capped AI spend.

## What You'll Build

A SaaS application where:
- Each customer gets AI copilot features
- Customer A's usage doesn't affect Customer B
- Per-customer spend limits protect your margins
- One aggressive user cannot drain your AI budget

## Why This Matters

You're building a SaaS with AI features. Pricing is $50/month per seat. Your AI costs average $5/user/month. Margin: $45.

Then one user discovers they can ask the copilot to "analyze this 200-page document" repeatedly. Their usage: $200/month. Your margin: -$150.

Without per-user enforcement:
- Power users subsidized by normal users
- Margin erosion invisible until P&L review
- No way to limit without degrading everyone's experience

With Saturn:
- Each user has a budget
- Aggressive user hits their cap
- Other users unaffected
- Margin protected

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your SaaS Application                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Customer A │  │  Customer B │  │     Customer C      │  │
│  │  Agent: A   │  │  Agent: B   │  │     Agent: C        │  │
│  │  Cap: $10   │  │  Cap: $10   │  │     Cap: $10        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                         Saturn                              │
│         Per-agent isolation • Per-agent caps                │
│         Agent A exhausted? B and C continue.                │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step

### 1. Create Agent on Customer Signup

```typescript
async function onCustomerSignup(customerId: string, plan: string) {
  // Determine cap based on plan
  const dailyCap = plan === 'pro' ? 2000 : 500; // $20 or $5

  // Create dedicated Saturn agent for this customer
  const { id: agentId, apiKey } = await saturnAdmin.agents.create({
    name: `customer-${customerId}`,
    maxPerDayUsdCents: dailyCap,
    maxPerCallUsdCents: 100, // $1 max per call
  });

  // Store association
  await db.customers.update(customerId, {
    saturnAgentId: agentId,
    saturnApiKey: encrypt(apiKey),
  });
}
```

### 2. Use Customer's Agent for Their Requests

```typescript
async function handleCopilotRequest(customerId: string, prompt: string) {
  const customer = await db.customers.findById(customerId);

  // Each customer uses their own Saturn agent
  const saturn = new Saturn({
    apiKey: decrypt(customer.saturnApiKey),
  });

  try {
    const result = await saturn.reason({ prompt });

    return {
      response: result.data.content,
      cost: result.metadata.chargedUsdCents,
    };

  } catch (err) {
    if (err.code === 'BUDGET_EXCEEDED') {
      // Customer hit their limit
      return {
        response: null,
        error: 'Daily AI limit reached. Resets at midnight UTC.',
        upgradeUrl: '/pricing', // Upsell opportunity
      };
    }
    throw err;
  }
}
```

### 3. Margin Protection in Practice

```
Customer A (Normal user):
- 50 requests/day
- Average cost: $0.05 each
- Daily spend: $2.50
- Monthly: ~$75
- Your revenue: $50
- Your cost: $75
- Margin: -$25 ❌

With Saturn cap at $5/day:
- Customer A makes 50 requests
- At request 40, cap reached ($5)
- Requests 41-50: "Limit reached"
- Your cost: $5/day max = $150/month max
- Actually: $5 × 20 working days = $100
- Margin: -$50 → but predictable and bounded
```

Better yet, set cap at $1.67/day ($50/month) to guarantee margin:

```
Customer A:
- Cap: $1.67/day
- Monthly max: $50
- Your revenue: $50
- Your cost: ≤$50
- Margin: ≥$0 ✓
```

### 4. Handle Aggressive Users

```typescript
// Monitor for users consistently hitting caps
async function checkUsagePatterns() {
  const customers = await db.customers.findAll();

  for (const customer of customers) {
    const usage = await saturnAdmin.agents.getUsage(customer.saturnAgentId);

    if (usage.daysAtCapThisMonth > 15) {
      // User hitting cap most days
      await notifyCustomerSuccess({
        customerId: customer.id,
        message: 'Heavy AI user - upsell candidate or cost risk',
        usage,
      });
    }
  }
}
```

## Failure Scenario: The Whale User

Without per-user limits:

```
User discovers: "Summarize this PDF" works on any PDF
User uploads: 500-page legal documents, repeatedly
Cost per document: $2-5
User runs: 100 documents
Your bill: $200-500 for one user
Your revenue from user: $50
```

With Saturn:

```
User uploads: 500-page legal document
Cost: $3
User uploads: another document
Cost: $3
After 3 documents: BUDGET_EXCEEDED
User sees: "Daily limit reached"
Your cost: $9 (capped)
Your margin: protected
```

## Where Financial Guardrails Matter

| Risk | Without Saturn | With Saturn |
|------|----------------|-------------|
| Whale user | Destroys margins | Bounded by cap |
| User A abuse | Affects all users | Isolated to User A |
| Pricing mistakes | Discover at month end | Discover immediately |
| Cost forecasting | Impossible | Predictable (sum of caps) |

## Production Checklist

- [ ] Agent created per customer on signup
- [ ] Agent deleted/disabled on customer churn
- [ ] Caps set based on pricing tier
- [ ] Graceful "limit reached" UX (not error page)
- [ ] Upsell path when limit reached
- [ ] Usage monitoring for heavy users
- [ ] Plan upgrade increases cap automatically

## Extend This

- **Tiered caps**: Free: $1/day, Pro: $10/day, Enterprise: $100/day
- **Rollover**: Unused budget carries over (implement via periodic cap increases)
- **Usage dashboard**: Show customers their AI usage
- **Alerts**: Notify customers approaching limit
- **Burst allowance**: Allow 2x cap occasionally, flag for review
