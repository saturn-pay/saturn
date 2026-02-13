# Saturn Engineering Onboarding

Welcome to Saturn — financial guardrails for AI agents.

This document walks through the codebase architecture, key flows, and how the pieces connect.

---

## Overview

Saturn is a runtime financial control layer for autonomous AI agents. Three main components:

| Component | Stack | Purpose |
|-----------|-------|---------|
| **API** | Express.js + TypeScript | Routes proxy calls, enforces policies, manages billing |
| **SDK** | TypeScript (`@saturn-pay/sdk`) | Client library for agents |
| **Dashboard** | Next.js 14 | Web UI for account management |

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Agent     │ ──── │   Saturn    │ ──── │  Upstream   │
│  (SDK)      │      │    API      │      │  Providers  │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                     ┌──────┴──────┐
                     │  PostgreSQL │
                     └─────────────┘
```

---

## Project Structure

```
saturn/
├── src/                    # Backend API
│   ├── config/             # Environment & constants
│   ├── db/                 # Drizzle ORM schema & client
│   ├── routes/             # Express routers
│   ├── middleware/         # Auth, error handling, logging
│   ├── services/           # Business logic
│   │   └── proxy/          # Adapter pattern for providers
│   ├── jobs/               # Background tasks
│   ├── lib/                # Utilities (errors, logger, LND client)
│   └── types/              # TypeScript definitions
├── sdk/                    # TypeScript SDK
│   └── src/
│       ├── resources/      # API resource wrappers
│       └── types.ts        # SDK types
├── web/                    # Next.js dashboard
│   └── src/
│       ├── app/            # App router pages
│       ├── components/     # UI components
│       └── lib/            # Utilities & hooks
├── drizzle/                # Generated SQL migrations
├── tests/                  # Test suites
└── scripts/                # Utility scripts
```

---

## 1. Backend API (`/src`)

### Entry Point: `src/index.ts`

Initialization order:
1. Sentry (error tracking)
2. Security middleware (helmet, CORS)
3. Rate limiters (100 req/min default)
4. Mount routes at `/v1`
5. Test database connection
6. Initialize service adapters
7. Start background jobs (rate updater, invoice watcher)

### Configuration

**`src/config/env.ts`** — Zod-validated environment schema

Key variables:
- `DATABASE_URL` — PostgreSQL connection (required)
- `LND_*` — Lightning Network credentials
- `STRIPE_*` — Payment processing
- Provider API keys (OpenAI, Anthropic, etc.)

**`src/config/constants.ts`** — Core constants

```typescript
ID_PREFIXES = {
  account: 'acc',
  agent: 'agt',
  wallet: 'wal',
  policy: 'pol',
  // ...
}

DEFAULT_POLICY = {
  maxPerDaySats: 10_000,
  killSwitch: false,
}
```

### Database Schema (`src/db/schema/`)

Core entities:

| Table | Purpose |
|-------|---------|
| `accounts` | User/team accounts |
| `agents` | AI agents (belong to accounts) |
| `wallets` | Per-account balances (sats + USD) |
| `policies` | Per-agent spending rules |
| `services` | Provider definitions |
| `service_pricing` | Per-operation pricing |
| `transactions` | Wallet movement audit trail |
| `audit_logs` | Per-call execution logs |
| `invoices` | Lightning invoice tracking |
| `checkout_sessions` | Stripe checkout tracking |

Key relationships:
- Account 1:N Agents
- Account 1:1 Wallet
- Agent 1:1 Policy
- Wallet 1:N Transactions

### Routes (`src/routes/`)

```
/v1/
├── /signup                 # Create account + agent
├── /auth                   # JWT session login
├── /accounts               # Account CRUD
├── /agents                 # Agent management
├── /agents/:id/policy      # Policy read/update
├── /wallet                 # Balance & funding
├── /capabilities/:cap      # Execute capability (reason, search, etc.)
├── /proxy/:service         # Raw service proxy
├── /services               # Service catalog
└── /admin                  # Platform stats (primary only)
```

### Middleware (`src/middleware/`)

**`auth.ts`** — Authentication flow:
1. Extract Bearer token from header
2. If `sk_agt_*` prefix → API key auth (bcrypt verify)
3. Else → JWT auth (session token)
4. Load account, wallet, policy onto `req`
5. Reject if agent suspended/killed

**`error-handler.ts`** — Centralized error handling:
- Converts errors to JSON responses
- Reports to Sentry in production
- Custom error classes in `src/lib/errors.ts`

### Services (`src/services/`)

**`wallet.service.ts`** — Wallet operations
- `hold()` — Lock funds before upstream call
- `settle()` — Move held → spent after success
- `release()` — Return held funds on failure
- `creditFromInvoice()` / `creditFromCheckout()` — Add funds

**`policy.service.ts`** — Policy evaluation
- Checks 9 rules in order (active, kill switch, service allow/deny, capability allow/deny, per-call limit, daily limit)
- Caches daily spend with 60s TTL

**`audit.service.ts`** — Audit logging
- Creates immutable record for each proxy call

### Proxy Execution (`src/services/proxy/`)

**The core flow** — `proxy-executor.ts`:

```
Request arrives
    ↓
1. QUOTE — adapter.quote() estimates cost
    ↓
2. POLICY CHECK — evaluate against agent's policy
    ↓
3. HOLD — lock estimated amount in wallet
    ↓
4. EXECUTE — adapter.execute() calls upstream
    ↓
5. FINALIZE — adapter.finalize() adjusts final cost
    ↓
6. SETTLE — move held → spent, record transaction
    ↓
7. AUDIT — log with all metadata
    ↓
Return response + metadata headers
```

**Adapter pattern** — Each provider has an adapter:
```typescript
interface BaseAdapter {
  slug: string;
  quote(body): { operation, quotedSats };
  execute(body): { status, data, headers };
  finalize(response, quotedSats): { finalSats };
}
```

Registered adapters: OpenAI, Anthropic, Serper, Firecrawl, E2B, Jina, Brave, Resend, Twilio, Replicate, ElevenLabs, Deepgram, ScraperAPI, Hunter, Pinecone

### Background Jobs (`src/jobs/`)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `rate-updater` | Every 5 min | Refresh BTC/USD rate |
| `invoice-watcher` | Continuous | Listen for Lightning payments |
| `invoice-expiry` | Periodic | Mark expired invoices |

---

## 2. SDK (`/sdk`)

Published as `@saturn-pay/sdk`

### Main Client

```typescript
import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({ apiKey: 'sk_agt_...' });

// Capability methods
await saturn.reason({ prompt: '...' });
await saturn.search({ query: '...' });
await saturn.read({ url: '...' });
await saturn.execute({ code: '...' });

// Resource access
await saturn.agents.list();
await saturn.wallet.getBalance();
await saturn.policies.update(agentId, { maxPerDaySats: 5000 });

// Static signup
const { saturn, apiKey } = await Saturn.signup({ name: 'My Agent' });
```

### Structure

```
sdk/src/
├── index.ts          # Saturn class (main export)
├── client.ts         # HttpClient (raw transport)
├── resources/        # API resource wrappers
│   ├── accounts.ts
│   ├── agents.ts
│   ├── policies.ts
│   ├── wallets.ts
│   └── ...
├── types.ts          # TypeScript interfaces
└── errors.ts         # SaturnError hierarchy
```

### Response Metadata

Proxy calls return metadata headers:
- `x-saturn-audit-id` — Unique call ID
- `x-saturn-quoted-sats` — Estimated cost
- `x-saturn-charged-sats` — Actual cost
- `x-saturn-balance-after` — Remaining balance

---

## 3. Dashboard (`/web`)

Next.js 14 App Router

### Pages

```
/signin               # Login
/signup               # Create account
/(dashboard)/         # Protected layout
  ├── /              # Home (balance, agents, stats)
  ├── /keys          # API key management
  ├── /wallet        # Fund wallet (Stripe)
  ├── /pricing       # Service pricing
  └── /quickstart    # Getting started
```

### Key Files

- `web/src/lib/api.ts` — API client wrapper
- `web/src/lib/auth.tsx` — Session management
- `web/src/components/` — Reusable UI components

---

## Key Flows

### Signup

```
POST /v1/signup { userName, name, email, password }
    ↓
Create account (name = userName)
    ↓
Create primary agent (name = name)
    ↓
Create wallet for account
    ↓
Create default policy for agent
    ↓
Return { accountId, agentId, apiKey }
```

### Proxy Call (e.g., `saturn.reason()`)

```
POST /v1/capabilities/reason
    ↓
Auth middleware loads agent, account, wallet, policy
    ↓
Adapter quotes cost based on model + tokens
    ↓
Policy service checks all rules
    ↓
Wallet service holds estimated amount
    ↓
Adapter executes upstream call
    ↓
On success: settle (held → spent), audit, return
On failure: release hold, audit, return error
```

### Wallet Funding (Stripe)

```
POST /v1/wallet/fund-card { amountUsdCents }
    ↓
Create Stripe checkout session
    ↓
Return { checkoutUrl }
    ↓
User completes payment in browser
    ↓
Stripe webhook → POST /webhooks/stripe
    ↓
Credit wallet, create transaction
```

---

## Authentication

### API Key Auth (agents)

Format: `sk_agt_` + 64 hex chars

Storage:
- Full key shown once at creation
- Bcrypt hash stored in `agents.apiKeyHash`
- SHA-256 prefix (16 chars) in `agents.apiKeyPrefix` for fast lookup

Lookup:
1. Hash incoming key with SHA-256
2. Query by prefix (fast index scan)
3. Verify match with bcrypt

### JWT Auth (dashboard)

- Issued at `/v1/auth/signin`
- Stored in httpOnly cookie
- Payload: `{ accountId, agentId }`

---

## Policy Enforcement

Checked before each proxy call:

1. Agent status = 'active'
2. Kill switch = false
3. Service not in `deniedServices`
4. Service in `allowedServices` (if set)
5. Capability not in `deniedCapabilities`
6. Capability in `allowedCapabilities` (if set)
7. Quoted cost ≤ `maxPerCallSats`
8. Daily spend + quoted ≤ `maxPerDaySats`

Any failure → reject with `PolicyDeniedError`

---

## Development

### Setup

```bash
# Install dependencies
npm install

# Start Postgres
docker compose up -d postgres

# Run migrations
npm run db:migrate

# Start API (port 3000)
npm run dev

# Start dashboard (port 3001)
cd web && npm run dev
```

### Testing

```bash
npm test              # Unit + integration
npm run test:e2e      # Playwright E2E
```

### Database

```bash
npm run db:generate   # Generate migration from schema changes
npm run db:migrate    # Run migrations
npm run pricing:update # Update service pricing
```

---

## Environment Variables

Required:
- `DATABASE_URL` — PostgreSQL connection

Lightning (optional):
- `LND_SOCKET`, `LND_TLS_CERT`, `LND_MACAROON`

Stripe:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Providers (as needed):
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SERPER_API_KEY`, etc.

See `.env.example` for full list.

---

## Quick Reference

### API Endpoints

```
POST   /v1/signup                    # Create account
POST   /v1/auth/signin               # Login

GET    /v1/agents                    # List agents
POST   /v1/agents                    # Create worker agent
GET    /v1/agents/:id/policy         # Get policy
PUT    /v1/agents/:id/policy         # Update policy

GET    /v1/wallet                    # Get balance
POST   /v1/wallet/fund-card          # Stripe checkout
GET    /v1/wallet/transactions       # History

POST   /v1/capabilities/:cap         # Execute capability
GET    /v1/services                  # List services
```

### Capabilities

| Capability | Purpose | Providers |
|------------|---------|-----------|
| `reason` | LLM inference | OpenAI, Anthropic |
| `search` | Web search | Serper, Brave |
| `read` | URL to text | Jina, Firecrawl |
| `scrape` | URL to HTML | Firecrawl, ScraperAPI |
| `execute` | Code execution | E2B |
| `email` | Send email | Resend |
| `sms` | Send SMS | Twilio |
| `imagine` | Image generation | Replicate |
| `speak` | Text to speech | ElevenLabs |
| `transcribe` | Speech to text | Deepgram |

---

## Questions?

Check the codebase or ask in the team channel.
