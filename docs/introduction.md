# Introduction

Saturn is a runtime financial guardrails layer for AI agents. It enforces per-agent identity, prepaid credits, hard spend limits, and returns structured receipts for every paid API call.

## Runtime Enforcement vs Dashboards

Dashboards show you what happened. Saturn prevents what shouldn't happen.

| Approach | When it acts | Outcome |
|----------|--------------|---------|
| Dashboard alerts | After spend occurs | You see the bill |
| Saturn enforcement | Before upstream call | Call rejected if over budget |

Saturn operates at the execution boundary. Every capability call passes through policy checks before reaching any upstream provider. Over-budget calls are rejected—not logged, not alerted, rejected.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Agent                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Saturn                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Policy    │  │   Ledger    │  │   Provider Router   │  │
│  │   Engine    │──│   (Credits) │──│   (OpenAI, etc.)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Upstream Providers (OpenAI, Anthropic, etc.)   │
└─────────────────────────────────────────────────────────────┘
```

Every call:
1. Authenticated via agent API key
2. Checked against policy (caps, allowed capabilities)
3. Quoted against current credit balance
4. Executed only if all checks pass
5. Settled atomically with receipt issued

## When to Use Saturn

- AI agents that call paid APIs autonomously
- Multi-tenant SaaS with per-user AI features
- Production systems where cost overruns are unacceptable
- Teams using multiple LLM providers under unified budgets
- Any autonomous system that can spend money

## When Not to Use Saturn

- Single-user CLI tools with manual oversight
- Development environments where cost is irrelevant
- Systems where you want unbounded spend
- Scenarios requiring direct provider API access for unsupported features
