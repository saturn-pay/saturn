# Saturn

Lightning-powered API proxy for AI agents. Every agent gets a wallet, a set of capabilities, and a policy — priced per use, paid in Bitcoin.

## What It Does

Saturn sits between your AI agent and the APIs it needs. Instead of handing agents raw API keys, you fund a wallet with sats over Lightning. The agent calls capabilities (`reason`, `search`, `execute`, etc.), Saturn routes to the best provider, charges the wallet, and logs everything.

- **10 capabilities**: reason, search, read, scrape, execute, email, sms, imagine, speak, transcribe
- **15+ upstream providers**: OpenAI, Anthropic, Serper, Firecrawl, E2B, Jina, Brave, Resend, Twilio, Replicate, ElevenLabs, Deepgram, and more
- **Per-agent policies**: max per call, daily budgets, allowed/denied capabilities, kill switch
- **Full audit trail**: every call logged with sats charged, latency, and policy result
- **Lightning payments**: instant micropayments, no minimums, no chargebacks

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/saturn-pay/saturn.git
cd saturn
npm install
```

### 2. Set up the database

```bash
# Start Postgres (or use docker-compose)
docker compose up -d postgres

# Run migrations
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
| POST | `/v1/capabilities/:capability` | Execute a capability (reason, search, etc.) |

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
┌──────────────┐     ┌────────────────┐     ┌───────────────┐
│   AI Agent   │────▶│     Saturn     │────▶│   Upstream    │
│  (SDK call)  │◀────│  (proxy/bill)  │◀────│   Provider    │
└──────────────┘     └────────────────┘     └───────────────┘
                            │
                     ┌──────┼──────┐
                     │      │      │
                     ▼      ▼      ▼
                   [PG]  [LND]  [Sentry]
```

- **Express + TypeScript** backend
- **PostgreSQL** with Drizzle ORM for data
- **LND** (Lightning Network Daemon) for payments
- **Sentry** for error tracking (optional)
- **Pino** for structured logging

### Key Directories

```
src/
├── config/          # Environment and constants
├── db/              # Drizzle schema, client, seed
├── jobs/            # Background jobs (invoice watcher, rate updater, expiry)
├── lib/             # Utilities (logger, LND client, errors)
├── middleware/       # Auth, error handler, request logger
├── routes/          # Express route handlers
├── services/        # Business logic
│   └── proxy/       # Adapter registry, capability routing, executor
└── types/           # Internal TypeScript types
sdk/                 # @saturn-pay/sdk TypeScript SDK
web/                 # Next.js admin dashboard
drizzle/             # SQL migration files
```

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

# With seed data
./scripts/deploy.sh --migrate --seed
```

### Voltage (LND Setup)

1. Create a Voltage node at [voltage.cloud](https://voltage.cloud)
2. Download the TLS certificate and base64-encode it:
   ```bash
   base64 -i tls.cert | tr -d '\n'
   ```
3. Bake a restricted macaroon:
   ```bash
   lncli bakemacaroon invoices:read invoices:write info:read --save_to=saturn.macaroon
   base64 -i saturn.macaroon | tr -d '\n'
   ```
4. Set `LND_SOCKET`, `LND_TLS_CERT`, and `LND_MACAROON` in your `.env`

### Environment Variables

See [.env.example](.env.example) for all available configuration options.

## Development

```bash
# Run in dev mode (hot reload)
npm run dev

# Type check
npx tsc --noEmit

# Run tests
npm test

# Watch tests
npm run test:watch

# Generate migration
npm run db:generate

# Run migration
npm run db:migrate

# Seed database
npm run seed
```

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

ISC
