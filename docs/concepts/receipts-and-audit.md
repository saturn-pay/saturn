# Receipts & Audit IDs

## Definition

Every successful Saturn call returns a **receipt**—a structured record of what happened, what it cost, and how to trace it.

```typescript
{
  auditId: "aud_7f3k...x9m2",
  capability: "reason",
  provider: "openai",
  chargedUsdCents: 24,
  balanceAfterUsdCents: 4976,
  quotedUsdCents: 24,
  latencyMs: 1240,
  policyResult: "allowed",
  createdAt: "2024-01-15T10:23:45Z"
}
```

The **audit ID** is a unique identifier for this specific call. It correlates to ledger entries, logs, and upstream provider calls.

## Why It Exists

Receipts provide:
- **Cost attribution**: Know exactly what each call cost
- **Debugging**: Trace failures to specific calls
- **Reconciliation**: Match Saturn charges to provider invoices
- **Compliance**: Audit trail for financial systems

Without receipts, you have aggregate spend with no visibility into composition.

## Enforcement Behavior

Receipts are generated atomically with settlement:
- Call succeeds → Receipt issued with `chargedUsdCents`
- Call fails (upstream error) → Receipt issued with `chargedUsdCents: 0` or partial charge
- Call rejected (policy) → No receipt; error returned with rejection reason

Receipts are immutable. Once issued, they cannot be modified.

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Not logging audit IDs | Cannot trace issues |
| Ignoring receipt metadata | Missing cost insights |
| Assuming all calls have same cost | Actual cost varies by input/output |

## Example

```typescript
const result = await saturn.reason({
  prompt: 'Summarize this document...',
});

// Always log the audit ID for traceability
logger.info('LLM call completed', {
  auditId: result.metadata.auditId,
  cost: result.metadata.chargedUsdCents,
  provider: result.metadata.provider,
  latency: result.metadata.latencyMs,
});

// Store audit IDs for reconciliation
await db.calls.insert({
  auditId: result.metadata.auditId,
  userId: currentUser.id,
  cost: result.metadata.chargedUsdCents,
});
```
