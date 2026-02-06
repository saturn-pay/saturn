# Dual-Currency Wallets: USD + Sats

## Problem

Currently, Stripe payments convert USD → sats at deposit time. This exposes card users to BTC volatility:

1. User pays $10 via Stripe
2. At $100k BTC, they get 10,000 sats
3. BTC drops to $50k
4. Their 10,000 sats now worth $5
5. User lost 50% of their deposit value through no fault of their own

Lightning users don't have this problem — they deposit sats, hold sats, spend sats. No conversion.

## Proposal

Keep each currency in its own lane:

| Funding Method | Deposit | Balance | Spend | Volatility |
|----------------|---------|---------|-------|------------|
| Lightning | sats | `balanceSats` | sats | None |
| Stripe | USD | `balanceUsdCents` | USD | None |

No cross-currency conversion. Each user stays in their native currency.

## Schema Changes

### Wallets Table

```sql
ALTER TABLE wallets ADD COLUMN balance_usd_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN held_usd_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN lifetime_in_usd_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN lifetime_out_usd_cents bigint NOT NULL DEFAULT 0;

ALTER TABLE wallets ADD CONSTRAINT balance_usd_non_negative CHECK (balance_usd_cents >= 0);
ALTER TABLE wallets ADD CONSTRAINT held_usd_non_negative CHECK (held_usd_cents >= 0);
```

### Transactions Table

```sql
ALTER TABLE transactions ADD COLUMN currency text NOT NULL DEFAULT 'sats'
  CHECK (currency IN ('sats', 'usd_cents'));
ALTER TABLE transactions ADD COLUMN amount_usd_cents bigint; -- nullable, only for USD transactions
```

### Accounts Table (new column)

```sql
ALTER TABLE accounts ADD COLUMN default_currency text NOT NULL DEFAULT 'usd_cents'
  CHECK (default_currency IN ('sats', 'usd_cents'));
```

This tracks which currency the account primarily uses. Set on first funding:
- First Lightning deposit → `default_currency = 'sats'`
- First Stripe deposit → `default_currency = 'usd_cents'`

## Funding Flows

### Lightning (unchanged)
```
POST /wallet/fund { amountSats: 10000 }
→ Creates LN invoice
→ On settlement: credit balanceSats
```

### Stripe (updated)
```
POST /wallet/fund-card { amountUsdCents: 1000 }
→ Creates Stripe checkout ($10.00)
→ On webhook: credit balanceUsdCents (NOT converted to sats)
```

## Spending Logic

When a proxy call is made, use the **account's default currency first**, then fall back.

### Recommended: Default-currency-first
```typescript
async function deductForCall(account, wallet, costUsdMicros) {
  const costUsdCents = Math.ceil(costUsdMicros / 10000);
  const costSats = usdCentsToSats(costUsdCents, currentBtcRate);

  // Try account's default currency first
  if (account.defaultCurrency === 'usd_cents') {
    if (wallet.balanceUsdCents >= costUsdCents) {
      return deductUsd(wallet, costUsdCents);
    }
    // Fall back to sats
    if (wallet.balanceSats >= costSats) {
      return deductSats(wallet, costSats);
    }
  } else {
    // Account prefers sats
    if (wallet.balanceSats >= costSats) {
      return deductSats(wallet, costSats);
    }
    // Fall back to USD
    if (wallet.balanceUsdCents >= costUsdCents) {
      return deductUsd(wallet, costUsdCents);
    }
  }

  throw new InsufficientBalanceError();
}
```

### Why this approach

If a user *intentionally* funded with sats but later tops up $5 via Stripe:
- Global "USD-first" would drain USD immediately, leaving sats untouched
- This feels wrong to Lightning-native users

By respecting `defaultCurrency`:
- Users get what they expect
- First funding method sets the tone
- Still has fallback for mixed balances

### Setting defaultCurrency

- Set on **first successful funding**
- Lightning invoice settles first → `sats`
- Stripe checkout completes first → `usd_cents`
- Changeable via account settings later (future feature)

## API Changes

### GET /wallet Response
```json
{
  "id": "wal_xxx",
  "accountId": "acc_xxx",
  "balanceSats": 50000,
  "balanceUsdCents": 1000,
  "heldSats": 0,
  "heldUsdCents": 0,
  "lifetimeInSats": 100000,
  "lifetimeInUsdCents": 2000,
  "lifetimeOutSats": 50000,
  "lifetimeOutUsdCents": 1000
}
```

### Proxy Response Metadata
```json
{
  "metadata": {
    "quotedUsdCents": 5,
    "chargedUsdCents": 4,
    "currency": "usd",
    "balanceAfterUsdCents": 996,
    "balanceAfterSats": 50000
  }
}
```

## Service Pricing

Services are already priced in USD (`price_usd_micros`). Current flow converts to sats at call time. New flow:

- **USD balance:** Deduct `price_usd_micros / 10000` cents directly
- **Sats balance:** Convert `price_usd_micros` to sats at current rate (existing logic)

## Migration Path

1. Add new columns with defaults (non-breaking)
2. Existing sats balances unchanged
3. New Stripe deposits go to USD balance
4. Spending logic checks both balances

No data migration needed — existing users keep sats, new card deposits go to USD.

## Open Questions

1. **Refunds:** If call fails, refund to same currency used
   - Track `currency` on hold, refund to matching balance

2. **Admin dashboard:** Show both balances, allow filtering transactions by currency

3. **Minimum amounts:**
   - Lightning: 1000 sats min (existing)
   - Stripe: $5 min (existing, covers fees)

4. **Withdrawals:** Future feature — withdraw sats via Lightning, USD via Stripe payouts?

5. **Change defaultCurrency:** Allow users to switch via settings? Or auto-detect from most recent funding?

## Implementation Order

1. Schema migration (add USD columns to wallets, defaultCurrency to accounts)
2. Update wallet service (dual balance operations: holdUsd, settleUsd, creditUsd)
3. Update Stripe webhook (credit USD, set defaultCurrency on first fund)
4. Update Lightning invoice watcher (set defaultCurrency on first fund)
5. Update proxy executor (default-currency-first spending logic)
6. Update API responses (include both balances)
7. Update SDK types
8. Update admin dashboard

## Alternatives Considered

### A. Convert everything to USD internally
- Lose Bitcoin native appeal
- Lightning users forced into USD
- Defeats the purpose of accepting Bitcoin

### B. Convert everything to sats internally (current)
- Card users exposed to volatility
- Bad UX for mainstream users
- "I paid $10, why do I only have $7 worth of credits?"

### C. Let user choose at deposit time
- "Convert my $10 to sats" vs "Keep as USD"
- More complex UX
- Could add later as power-user feature

### D. Real-time conversion at spend time
- User has sats, call costs USD, convert at call time
- Reintroduces volatility
- Defeats the purpose

## Recommendation

Ship **dual balances with default-currency-first spending**:
- Simple mental model: "your money stays in the currency you deposited"
- No volatility for either user type
- Respects user intent (Lightning users stay in sats, Stripe users stay in USD)
- Backwards compatible with existing sats balances
- Minimal UX changes

**Marketing message:**
> "Fund in USD or sats. Spend per call. No volatility."
