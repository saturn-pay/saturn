# Credits & Ledger

## Definition

**Credits** are prepaid funds in your Saturn account. The **ledger** is the immutable record of all credit movements—deposits, deductions, and refunds.

Credits are denominated in USD cents internally. You add credits via card payment. Agents spend credits per-call.

## Why It Exists

Prepaid credits create a hard ceiling. You cannot spend money you haven't deposited. This is fundamentally different from post-pay models where the bill arrives after damage is done.

The ledger provides:
- Complete audit trail
- Per-agent attribution
- Reconciliation data
- Refund tracking

## Enforcement Behavior

Before every upstream call:
1. Saturn quotes the expected cost
2. Credits are checked against the quote
3. If insufficient credits: call rejected with `CreditExhausted`
4. If sufficient: credits held, call executed, credits settled

Settlement is atomic. If the upstream call fails, held credits are released.

```
Quote: $0.024
Balance: $0.015
Result: REJECTED (CreditExhausted)
```

```
Quote: $0.024
Balance: $50.00
Result: Credits held → Call executed → $0.024 deducted → Receipt issued
```

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Not monitoring balance | Agents stop unexpectedly |
| Assuming credits = budget | Credits are pool; budgets are caps |
| Ignoring low-balance warnings | Production outage when credits exhaust |

## Example

```typescript
// Check current balance
const wallet = await saturn.wallet.balance();
console.log(`Available: $${(wallet.balanceUsdCents / 100).toFixed(2)}`);

// Every call returns cost in receipt
const result = await saturn.reason({ prompt: '...' });
console.log(`Charged: $${(result.metadata.chargedUsdCents / 100).toFixed(4)}`);
console.log(`Remaining: $${(result.metadata.balanceAfterUsdCents / 100).toFixed(2)}`);
```
