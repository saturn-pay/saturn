![CI](https://github.com/saturn-pay/saturn/actions/workflows/ci.yml/badge.svg)

# Saturn

Your agents need APIs. They shouldn't need your keys.

Saturn is the execution layer for AI agents. It sits between your agent and the APIs it calls — handling auth, routing, budget enforcement, and per-call receipts. Fund a wallet with sats over Lightning, give your agent a Saturn key, and deploy. No provider credentials in your runtime. No surprise bills. Every call audited.

## What Saturn Is

- A proxy that routes agent requests to 15+ upstream providers (OpenAI, Anthropic, Serper, Firecrawl, E2B, and more)
- A billing layer that charges per call in Bitcoin satoshis via Lightning Network
- A policy engine with per-agent budgets, rate limits, and capability allowlists
- A full audit trail — every call logged with cost, provider, latency, and policy result

## What Saturn Is Not

- Not an API aggregator or reseller — Saturn sells capabilities (verbs), not vendor access
- Not a wallet — Saturn maintains an internal ledger with receipts, not a custodial wallet
- Not a marketplace — every provider integration is vetted and curated

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/saturn-pay/saturn.git
cd saturn
npm install
```

### 2. Set up the database

```bash
docker compose up -d postgres
npm run db:migrate
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your LND and database credentials
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `LND_SOCKET` | LND gRPC endpoint (e.g. `yournode.m.voltageapp.io:10009`) |
| `LND_TLS_CERT` | Base64-encoded TLS certificate |
| `LND_MACAROON` | Base64-encoded restricted macaroon |

The LND macaroon should be restricted to invoice operations only:
```bash
lncli bakemacaroon invoices:read invoices:write info:read --save_to=saturn.macaroon
```

### 4. Start Saturn

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

### 5. Create an agent

```bash
curl -X POST http://localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent"}'
```

This returns an API key, agent ID, and account ID. Save the API key — it's only shown once.

## SDK

Install the TypeScript SDK:

```bash
npm install @saturn-pay/sdk
```

```typescript
import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({
  apiKey: 'sk_agt_...',
  baseUrl: 'http://localhost:3000',
});

// Use a capability
const result = await saturn.reason({
  prompt: 'What is the capital of France?',
});
console.log(result.data.content);
console.log(`Cost: ${result.metadata.chargedSats} sats`);

// Fund the wallet
const invoice = await saturn.wallet.fund({ amountSats: 10000 });
console.log('Pay:', invoice.paymentRequest);
```

See [sdk/README.md](sdk/README.md) for full SDK documentation.

## Capabilities

Saturn exposes 10 capability verbs. Each routes to the best available provider.

| Capability | What the agent gets | Backed by |
|------------|-------------------|-----------|
| `reason` | LLM inference — completions, summarization, extraction | OpenAI, Anthropic |
| `search` | Web search — query to ranked results | Serper, Brave |
| `read` | URL to clean text — articles, docs, pages | Jina, Firecrawl |
| `scrape` | URL to structured HTML — raw extraction | Firecrawl, ScraperAPI |
| `execute` | Sandboxed code execution — Python, JS, shell | E2B |
| `email` | Transactional email | Resend |
| `sms` | SMS messages | Twilio |
| `imagine` | Text to image generation | Replicate |
| `speak` | Text to speech | ElevenLabs |
| `transcribe` | Speech to text | Deepgram |

## API Reference

All endpoints are under `/v1`. Authentication is via `Authorization: Bearer <api_key>` header.

### Unauthenticated

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/signup` | Create account + agent, get API key |
| GET | `/health` | Health check |

### Capabilities

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/capabilities` | List all capabilities with providers and pricing |
| GET | `/v1/capabilities/:capability` | Get capability details |
| POST | `/v1/capabilities/:capability` | Execute a capability |

### Proxy (Direct Service Access)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/services` | List available services |
| GET | `/v1/services/:slug` | Get service details and pricing |
| POST | `/v1/proxy/:slug` | Proxy a request to a service |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/agents` | List agents |
| POST | `/v1/agents` | Create agent (returns API key) |
| GET | `/v1/agents/:id` | Get agent |
| PATCH | `/v1/agents/:id` | Update agent |

### Policies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/agents/:id/policy` | Get agent policy |
| PUT | `/v1/agents/:id/policy` | Replace policy |
| PATCH | `/v1/agents/:id/policy` | Update policy fields |

### Wallets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/wallet` | Get current agent's wallet |
| POST | `/v1/wallet/fund` | Create Lightning invoice to fund wallet |
| GET | `/v1/wallet/invoices` | List invoices |
| GET | `/v1/wallet/transactions` | List transactions |
| GET | `/v1/agents/:id/wallet` | Get agent's wallet (account owner) |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/admin/stats` | Dashboard statistics |
| GET | `/v1/admin/agents` | List all agents with balances |
| GET | `/v1/admin/transactions` | List all transactions |
| GET | `/v1/admin/audit-logs` | Query audit logs |
| GET | `/v1/admin/service-health` | Service health metrics |
| GET | `/v1/admin/rate` | Current BTC/USD rate |

### Registry (Community Services)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/registry/submit` | Submit a service for review |
| GET | `/v1/registry/submissions` | List your submissions |

## Architecture

```
Agent (SDK)  ──>  Saturn (proxy/bill/enforce)  ──>  Upstream Provider
                         |
                   ------+------
                   |     |     |
                  [PG] [LND] [Sentry]
```

- **Express + TypeScript** backend
- **PostgreSQL** with Drizzle ORM for data
- **LND** (Lightning Network Daemon) for payments
- **Sentry** for error tracking (optional)
- **Pino** for structured logging

### Key Directories

```
src/
  config/          Environment and constants
  db/              Drizzle schema, client, seed
  jobs/            Background jobs (invoice watcher, rate updater, expiry)
  lib/             Utilities (logger, LND client, errors)
  middleware/      Auth, error handler, request logger
  routes/          Express route handlers
  services/        Business logic
    proxy/         Adapter registry, capability routing, executor
  types/           Internal TypeScript types
sdk/               @saturn-pay/sdk TypeScript SDK
web/               Next.js admin dashboard (humans only)
drizzle/           SQL migration files
```

Agents never interact with the dashboard. Humans use it to fund accounts, set policies, and inspect receipts.

For deeper technical details, see [docs/tech-spec.md](docs/tech-spec.md) (capability routing specification) and [docs/provider-eligibility.md](docs/provider-eligibility.md) (provider requirements).

## Security and Trust

Saturn handles financial transactions. Security is not optional.

- **No provider keys in your runtime** — agents authenticate with Saturn; Saturn authenticates with upstream providers
- **Per-call receipts** — every call returns charged amount, provider, audit ID, and remaining balance
- **Hard budget enforcement** — over-budget calls are rejected before touching upstream
- **Policy engine** — per-agent kill switch, spend caps, rate limits, capability allowlists
- **Atomic billing** — funds are held before execution, settled or released after
- **Full audit trail** — every call logged to PostgreSQL with cost, latency, and policy result

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

## Deployment

### Docker

```bash
# Development
docker compose up

# Production
docker compose -f docker-compose.prod.yml up -d
```

### Deploy Script

```bash
# First deploy (with migrations)
./scripts/deploy.sh --migrate

# Subsequent deploys
./scripts/deploy.sh
```

### Environment Variables

See [.env.example](.env.example) for all available configuration options.

## Development

```bash
npm run dev          # Dev mode (hot reload)
npx tsc --noEmit     # Type check
npm test             # Run tests
npm run test:watch   # Watch tests
npm run db:generate  # Generate migration
npm run db:migrate   # Run migration
npm run seed         # Seed database
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and PR process.

## Testing

52 tests across 10 test files covering:

- Proxy billing (hold/settle/release lifecycle)
- Auth (SHA-256 prefix lookup + bcrypt verification)
- Adapter security (SSRF prevention, path traversal, method validation)
- Invoice settlement (atomic double-credit prevention)
- Policy evaluation (capability allow/deny)
- Input validation (Zod schemas)
- Error handling

```bash
npm test
```

## License

Business Source License 1.1 — see [LICENSE](LICENSE).

The SDK (`sdk/`) is licensed under MIT — see [sdk/README.md](sdk/README.md).
