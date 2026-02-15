# Error Model

Saturn returns structured errors with consistent codes and messages.

## Error Response Format

```typescript
{
  error: {
    code: "BUDGET_EXCEEDED",
    message: "Daily budget exceeded: $1.00 limit reached",
    details: {
      dailySpent: 100,
      dailyCap: 100,
      quotedCost: 15
    }
  }
}
```

## Error Codes

### `BUDGET_EXCEEDED` (HTTP 402)

Call rejected because it would exceed a cap.

**Causes:**
- `maxPerCallUsdCents` exceeded
- `maxPerDayUsdCents` exceeded

**Response includes:**
- Which cap was exceeded
- Current spend vs cap
- Quoted cost of rejected call

**Action:** Wait for daily reset, increase cap, or reduce call cost.

### `CREDIT_EXHAUSTED` (HTTP 402)

Call rejected because insufficient credits.

**Causes:**
- Account balance below quoted cost

**Response includes:**
- Available balance
- Quoted cost

**Action:** Add credits to account.

### `AGENT_KILLED` (HTTP 403)

Call rejected because agent's kill switch is active.

**Causes:**
- Kill switch enabled via dashboard or API

**Action:** Disable kill switch if intentional; investigate if unexpected.

### `CAPABILITY_DENIED` (HTTP 403)

Call rejected because capability not in agent's allowlist.

**Causes:**
- Agent policy restricts this capability

**Action:** Update agent policy to allow capability.

### `PROVIDER_ERROR` (HTTP 502)

Upstream provider returned an error.

**Response includes:**
- Provider name
- Upstream status code
- Upstream error message (sanitized)

**Action:** Check provider status; retry with backoff if transient.

### `PROVIDER_UNAVAILABLE` (HTTP 503)

Cannot reach upstream provider.

**Causes:**
- Network failure
- Provider outage
- Timeout

**Action:** Retry with exponential backoff.

## Retry Guidance

| Error Code | Retry? | Backoff |
|------------|--------|---------|
| `BUDGET_EXCEEDED` | No | Wait for reset or increase cap |
| `CREDIT_EXHAUSTED` | No | Add credits first |
| `AGENT_KILLED` | No | Manual intervention required |
| `CAPABILITY_DENIED` | No | Policy change required |
| `PROVIDER_ERROR` | Maybe | Depends on upstream error |
| `PROVIDER_UNAVAILABLE` | Yes | Exponential backoff |

## Idempotency

Saturn does not provide built-in idempotency keys. Each call is independent.

If you need idempotency:
- Generate a unique ID client-side
- Check your records before calling
- Store audit ID on success
- Use audit ID to detect duplicates
