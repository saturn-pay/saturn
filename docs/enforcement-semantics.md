# Enforcement Semantics

This document describes exactly how Saturn enforces financial guardrails at runtime.

## Order of Checks

Every capability call passes through checks in this exact order:

```
1. Authentication
   └─ Invalid key? → 401 Unauthorized

2. Agent Status
   └─ Kill switch active? → 403 AgentKilled

3. Capability Check
   └─ Capability denied by policy? → 403 CapabilityDenied

4. Quote Generation
   └─ Saturn estimates cost based on request

5. Per-Call Cap Check
   └─ Quote > maxPerCallUsdCents? → 402 BudgetExceeded

6. Daily Cap Check
   └─ (todaySpend + quote) > maxPerDayUsdCents? → 402 BudgetExceeded

7. Credit Check
   └─ Quote > availableCredits? → 402 CreditExhausted

8. Execution
   └─ All checks pass → Call upstream provider

9. Settlement
   └─ Deduct actual cost, issue receipt
```

If any check fails, the call is rejected. No upstream call is made. No credits are deducted.

## Atomicity

Credit operations are atomic:

1. **Hold**: Before upstream call, credits are held (reserved)
2. **Execute**: Upstream provider called
3. **Settle**: On success, held credits are deducted; on failure, held credits are released

This prevents:
- Double-charging on retries
- Credit leaks on failures
- Race conditions between concurrent calls

## Failure Scenarios

| Scenario | Saturn Behavior |
|----------|-----------------|
| Upstream provider returns error | Credits released, error passed through |
| Upstream provider times out | Credits released after timeout, error returned |
| Network failure to provider | Credits released, `ProviderUnavailable` error |
| Saturn internal error | Credits released, `InternalError` with audit ID |
| Partial streaming response | Charged for consumed tokens only |

## Hard-Stop Behavior

When a cap is reached, Saturn stops execution immediately:

```
Call 1: $0.30 → allowed (daily: $0.30 / $1.00)
Call 2: $0.35 → allowed (daily: $0.65 / $1.00)
Call 3: $0.25 → allowed (daily: $0.90 / $1.00)
Call 4: $0.15 → REJECTED (would be $1.05, exceeds $1.00 cap)
```

The agent cannot "finish one more call." The boundary is hard.

## Streaming Implications

For streaming responses (where supported):

- Credits are held for estimated max cost
- Actual charge is calculated on stream completion
- If stream is interrupted, charge reflects consumed portion
- If stream exceeds hold, it completes but agent may be over-budget for next call

Streaming does not bypass caps—it's estimated upfront and reconciled on completion.
