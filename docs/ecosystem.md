# Saturn Ecosystem — Architecture & Integration

## The Dependency

```
APAAI (independent — governs any agent action)
  │
  │  Saturn is designed to delegate governance to APAAI
  │
  ▼
Saturn (financial execution layer for agents)
  │
  │  SkillMart is a service on Saturn
  │
  ▼
SkillMart (knowledge marketplace — independent, but accessible through Saturn)
```

**APAAI does not need Saturn.** It governs any agent action — file writes, database queries, deployments, API calls. Financial transactions are just one action type.

**Saturn is designed to delegate governance to APAAI.** A financial execution layer without governance is a credit card with no cardholder. Saturn ships with basic built-in policy controls (kill switch, spend caps, service restrictions) but is architecturally designed to hand off identity, policy evaluation, approval workflows, and evidence recording to APAAI as the governance layer matures.

**SkillMart is independent** but becomes more powerful when accessible through Saturn's payment rail.

---

## The Stack

| Layer | Product | Question it answers | Depends on |
|-------|---------|-------------------|------------|
| **Governance** | APAAI | *Should this agent be allowed to do this?* | Nothing |
| **Execution** | Saturn | *How does this agent pay for and execute actions?* | APAAI (designed for, not hard-blocked) |
| **Marketplace** | SkillMart | *What knowledge can this agent acquire?* | Nothing (optionally Saturn) |

---

## Core Design Principle: Saturn Sells Capabilities, Not Vendors

Saturn is not an API aggregator. It does not resell access to OpenAI, Anthropic, or Twilio.

Saturn sells **agent actions** — verbs that describe what an agent can do. Providers are implementation details that Saturn manages internally.

```
┌─────────────────────────────────────────────────┐
│                   Agent                          │
│                                                  │
│   saturn.reason({ messages: [...] })             │
│   saturn.search({ query: "..." })                │
│   saturn.read({ url: "..." })                    │
│                                                  │
│   Agent sees: capabilities                       │
│   Agent doesn't see: which vendor fulfills them  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│                  Saturn                           │
│           Routing & Execution                     │
│                                                   │
│   reason  →  [ OpenAI | Anthropic | Mistral ]     │
│   search  →  [ Serper | Brave ]                   │
│   read    →  [ Firecrawl | Jina ]                 │
│                                                   │
│   Saturn picks the best route.                    │
│   Agent can optionally override: model: 'gpt-4o'  │
└──────────────────────────────────────────────────┘
```

### Why this matters

**Legally:** Saturn is a product that uses APIs under the hood, not a transparent proxy reselling API access. This changes the ToS posture with every provider.

**Commercially:** Saturn controls routing. If a provider raises prices, degrades quality, or revokes access, Saturn reroutes. Agent code never changes.

**Strategically:** Saturn negotiates as a traffic source ("we send you X million reasoning calls per month"), not a reseller ("can we resell your API?"). That's platform leverage.

---

## Service Catalog (v1)

Saturn sells 10 capabilities. Each is a verb — what the agent does, not what it buys.

| Service | Slug | What the agent gets | Backed by | Pricing |
|---------|------|-------------------|-----------|---------|
| **Reason** | `reason` | Think, plan, write, code. General reasoning, code generation, summarization, long-context analysis. | OpenAI, Anthropic, Mistral | per 1k tokens |
| **Search** | `search` | Find current, factual information. SERP results, fact-checking, source discovery. | Serper, Brave Search | per request |
| **Read** | `read` | Turn URLs into clean, structured text. Crawl pages, extract content, convert to markdown. | Firecrawl, Jina | per URL |
| **Scrape** | `scrape` | Read sites that block bots. JS rendering, proxy rotation, anti-bot handling. | ScraperAPI | per request |
| **Execute** | `execute` | Run code safely. Python/JS sandbox, data transforms, validation. | E2B | per session |
| **Email** | `email` | Send transactional email. Notifications, reports, one-off messages. | Resend | per email |
| **SMS** | `sms` | Send short text messages. Alerts, verifications, time-sensitive pings. | Twilio | per message |
| **Imagine** | `imagine` | Generate images from prompts. Diagrams, visuals, mockups. | Replicate | per generation |
| **Speak** | `speak` | Turn text into natural voice. Audio responses, voice reports. | ElevenLabs | per 1k chars |
| **Transcribe** | `transcribe` | Turn audio into text. Meetings, voice notes, interviews. | Deepgram | per minute |

### The agent interface

```typescript
// Default — Saturn routes to the best provider
await saturn.reason({ messages: [{ role: 'user', content: 'Summarize this doc' }] })
await saturn.search({ query: 'bitcoin price today' })
await saturn.read({ url: 'https://example.com/article' })
await saturn.execute({ language: 'python', code: 'print(2+2)' })

// Override — agent specifies a model when it matters
await saturn.reason({ messages: [...], model: 'gpt-4o' })
await saturn.reason({ messages: [...], model: 'claude-sonnet' })
```

Default is capability. Override is optional. Saturn handles routing, auth, billing, and policy enforcement regardless.

### Internal routing (not exposed to agents)

Each capability maps to a provider pool. Saturn selects based on cost, latency, availability, and quality:

```
reason     → openai:gpt-4o-mini (default cheap)
             openai:gpt-4o (quality)
             anthropic:claude-sonnet (long context)
             anthropic:claude-haiku (fast cheap)
             mistral:mistral-large (EU)

search     → serper (default)
             brave-search (fallback)

read       → firecrawl (default)
             jina (fallback)

scrape     → scraperapi

execute    → e2b

email      → resend

sms        → twilio

imagine    → replicate:flux (default)
             replicate:sdxl (fallback)

speak      → elevenlabs

transcribe → deepgram
```

This routing table is Saturn's internal concern. It can change without agent code changes. Future additions (quality tiers like `reason.fast` / `reason.deep`, cost tiers, region preferences) layer on top without breaking the base abstraction.

### Execution modes

Not all providers allow proxy-style access under their standard ToS. Saturn uses two execution modes internally:

| Mode | Description | Used for |
|------|-------------|----------|
| **Saturn-managed** | Saturn holds the provider account and credentials. Agent pays Saturn in sats. Saturn pays the provider. | Commodity, read-only, reputation-neutral services |
| **BYOK (Bring Your Own Key)** | Customer connects their own provider account. Saturn enforces policy and produces receipts, but the customer pays the provider directly. | Identity-bound, regulated, or reputation-sensitive services |

The agent doesn't know or care which mode is active. The interface is the same either way.

**v1 defaults:**
- Saturn-managed: `reason`, `search`, `read`, `execute`
- BYOK when needed: `email`, `sms` (Saturn-managed at low volume, BYOK for enterprise)
- Formal authorization required: `speak` (ElevenLabs reseller program), `imagine` (Replicate custom agreement)
- Self-hosted by Saturn: `read` (Firecrawl is AGPL, Jina is Apache-2.0 — can self-host to avoid ToS issues)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AI Agent                          │
│  (Claude, GPT, custom LLM agent, MCP server, etc.)  │
└──────────────┬──────────────────────────────────────┘
               │
               │ saturn.reason({ messages: [...] })
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                          APAAI                               │
│                    Governance Layer                           │
│                                                              │
│  Agent identity ─── Policy evaluation ─── Evidence chain     │
│                                                              │
│  • Who is this agent?                                        │
│  • What policies apply?                                      │
│  • Allow / block / require human approval?                   │
│  • Record everything that happens                            │
│                          │                                   │
│            ┌─────────────┼─────────────────┐                 │
│            │             │                 │                  │
│            ▼             ▼                 ▼                  │
│       auto-allow    flag + log     require approval          │
│                                     │                        │
│                                     ▼                        │
│                              Slack / email ── human decides  │
│                                                              │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ Decision: approved
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                         Saturn                               │
│              Execution & Billing Layer                        │
│                                                              │
│  Capabilities:                Owns:                          │
│  • reason                    • Lightning wallets              │
│  • search                    • Provider routing               │
│  • read                      • Sats billing & metering        │
│  • scrape                    • Service catalog                │
│  • execute                   • Upstream auth                  │
│  • email / sms               • Spend metadata (X-Saturn-*)   │
│  • imagine / speak           • Execution mode (managed/BYOK)  │
│  • transcribe                                                │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ Routes to best provider, charges sats
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Provider Pool                              │
│                (internal, not exposed)                        │
│                                                              │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │
│  │ OpenAI  │  │ Anthropic│  │ Serper   │  │ Firecrawl  │   │
│  │ Mistral │  │ Twilio   │  │ Resend   │  │ (self-host)│   │
│  │ E2B     │  │ Replicate│  │ Deepgram │  │ Jina       │   │
│  │         │  │ElevenLabs│  │ Brave    │  │ ScraperAPI │   │
│  └─────────┘  └──────────┘  └──────────┘  └────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## What APAAI Provides to Saturn

Saturn is designed to delegate these concerns to APAAI rather than owning them permanently:

### Agent Identity
Saturn ships with its own agent auth for v1. When APAAI integration is active, agents are APAAI entities. Saturn verifies identity and status through APAAI.

- Agent enrollment happens in APAAI (via enrollment keys or operator dashboard)
- Saturn provisions a wallet for each APAAI agent
- Agent tokens are APAAI-issued; Saturn validates them

### Policy Evaluation
Saturn ships with basic built-in policy (kill switch, allow/deny lists, sats caps). When APAAI integration is active, Saturn's policy system is replaced by APAAI's policy engine. All policy logic lives in one place.

APAAI policies for financial actions:
- "Allow `reason` calls under 500 sats without approval"
- "Flag any call to a capability the agent hasn't used before"
- "Require human approval for any spend over 5,000 sats"
- "Block all calls after business hours"
- "Require approval before purchasing any SkillMart skill over $50"
- "Cap daily spend at 50,000 sats across all capabilities"

Saturn asks APAAI before executing. APAAI returns allow/block/require_approval. Saturn obeys.

### Approval Workflows
When a call requires approval, Saturn holds the request while APAAI routes to a human via Slack, email, or webhook. On approval, Saturn proceeds. On rejection, Saturn returns 403 to the agent with the policy reason.

### Evidence & Audit
Every capability call becomes an APAAI evidence record:
- action_proposed: "agent wants to spend 500 sats on `reason`"
- policy_evaluated: "matched rule 'allow under 500 sats', auto-approved"
- action_executed: "charged 480 sats, routed to openai:gpt-4o-mini, upstream 200 OK, balance after 9520"

Saturn's audit log (`/v1/admin/audit-logs`) becomes a view into APAAI's evidence chain, not a separate data store.

---

## What Saturn Owns

These are Saturn's permanent concerns, regardless of APAAI integration:

### Lightning Wallets
- Wallet creation and balance management
- Lightning invoice generation and settlement
- Sats accounting (held, credited, debited)
- Balance checks before execution

### Capability Routing
- Maps capability verbs to provider pools
- Selects best provider per call (cost, latency, availability)
- Handles provider auth (managed keys or BYOK)
- Supports optional model override from agents
- Reroutes transparently when providers change

### Billing & Metering
- Per-call charge calculation
- Spend metadata on every response (X-Saturn-Audit-Id, X-Saturn-Charged-Sats, etc.)
- Transaction history
- Operator dashboards for spend analytics

### Service Catalog
- Public capability registry with pricing
- Per-capability pricing in sats
- Exchange rate tracking (USD/BTC)
- Service health monitoring

---

## Fail-Closed Behavior

When APAAI integration is active and APAAI is unreachable, Saturn blocks all calls by default. It does not silently skip governance.

- Saturn attempts policy evaluation via APAAI
- If APAAI is down or times out: **deny the request**
- Return 503 to the agent: "Governance service unavailable, request blocked"
- Log the failure for operator visibility
- No fallback to Saturn's own policy logic — that would defeat the purpose of delegation

This is a deliberate design choice. An agent that can spend money without governance is more dangerous than an agent that can't spend money at all.

When running in standalone mode (without APAAI), Saturn's built-in policy system handles enforcement directly.

---

## APAAI as Independent Product

APAAI continues to work without Saturn for non-financial governance:

- Code deployment approvals
- Database migration sign-off
- File system write authorization
- External API call auditing (without payment)
- Multi-agent coordination and delegation
- Compliance and regulatory evidence collection

Saturn is one consumer of APAAI's governance protocol. Other products could use APAAI for their own governance needs without any Saturn dependency.

---

## SkillMart in the Ecosystem

### Role
Knowledge marketplace. Where agents find structured, executable decision frameworks (SKILL.md files).

### Relationship to Saturn
SkillMart is a **capability on Saturn** — agents acquire skills through Saturn the same way they use any other capability:

```typescript
// Search for skills (free)
await saturn.learn({ action: 'search', query: 'code review' })

// Purchase and retrieve a skill (charges sats)
await saturn.learn({ action: 'acquire', slug: 'pr-review-senior' })
```

Saturn handles the payment (sats from agent wallet), SkillMart handles the content (SKILL.md delivery). Settlement between Saturn and SkillMart happens on the backend.

### Relationship to APAAI
Skill purchases are actions governed by APAAI like any other financial transaction. APAAI policies can gate skill purchases by price, category, or require human approval.

### What SkillMart stays focused on
- SKILL.md format and validation
- Creator ecosystem (GitHub integration, payouts)
- Search and discovery
- Affiliate system
- Quality signals (refund rates, sales counts)

SkillMart does not need to handle live services. That's Saturn's job.

---

## The Complete Agent Lifecycle

### 1. Onboarding
```
Operator enrolls agent in APAAI
  → APAAI issues agent token
  → APAAI applies default policies

Saturn detects new APAAI agent
  → Saturn provisions Lightning wallet
  → Operator funds wallet via Lightning invoice
```

### 2. Discovery
```
Agent → saturn.capabilities()
  "Available: reason, search, read, scrape, execute, email, sms, imagine, speak, transcribe"

Agent → saturn.learn({ action: 'search', query: 'code review' })
  "Found: 'Senior PR Review' for 2900 sats"

Agent → saturn.pricing('reason')
  "Default: 5 sats/1k tokens. model:gpt-4o: 50 sats/1k tokens."
```

### 3. Governance
```
Agent wants to: acquire a skill (2900 sats) + reason about code (50 sats)

Saturn → APAAI: propose action "acquire skill pr-review-senior, 2900 sats"
  APAAI policy: "skill purchase > 2000 sats → require_approval"
  APAAI → Slack: "@alice — agent wants to acquire 'Senior PR Review' for 2900 sats"
  Alice approves via Slack button
  APAAI → Saturn: approved, evidence recorded

Saturn → APAAI: propose action "reason, ~50 sats"
  APAAI policy: "reason calls under 500 sats → allow"
  APAAI → Saturn: auto-approved, evidence recorded
```

### 4. Execution
```
Saturn → routes to SkillMart
  Charges 2900 sats from agent wallet
  Returns SKILL.md content to agent

Agent reads SKILL.md, follows step-by-step logic

Saturn → routes to openai:gpt-4o (internally)
  Charges 50 sats from agent wallet
  Returns response to agent

Agent completes code review using skill + LLM
```

### 5. Audit
```
APAAI evidence chain (single source of truth):
  1. action_proposed: "acquire skill pr-review-senior, 2900 sats"
     policy_evaluated: matched "require_approval for purchases > 2000 sats"
     action_approved: by @alice via Slack at 14:23 UTC
     action_executed: charged 2900 sats, routed to skillmart, 200 OK

  2. action_proposed: "reason, ~50 sats"
     policy_evaluated: matched "auto-allow under 500 sats"
     action_executed: charged 48 sats, routed to openai:gpt-4o, 200 OK

Total spend: 2948 sats
Full evidence chain in APAAI. Financial details in Saturn.
```

---

## What Needs to Be Built

### Phase 1: Saturn standalone (v1)
- [x] Proxy routing with built-in policy (kill switch, spend caps, service restrictions)
- [x] Lightning wallets, sats billing, audit logs
- [x] TypeScript SDK
- [x] Refactor from vendor slugs (`openai`, `serper`) to capability verbs (`reason`, `search`)
- [x] Internal routing table: capability → provider pool (capability-registry.ts)
- [x] Capability policy enforcement (allowed/denied capabilities)
- [x] Capability audit logging
- [ ] Optional model override parameter
- [ ] Request/response normalization per capability
- [ ] Self-host Firecrawl and Jina for `read` capability
- [ ] Formal authorization for ElevenLabs (reseller program), Replicate, E2B

### Phase 2: APAAI integration
- [ ] Saturn calls APAAI for policy evaluation before capability calls (when configured)
- [ ] Saturn reports evidence to APAAI after execution
- [ ] Fail-closed: block requests when APAAI is unreachable (governance mode)
- [ ] APAAI enrollment provisions Saturn wallet automatically

### Phase 3: SkillMart as a capability
- [ ] `learn` capability: search + acquire skills through Saturn
- [ ] Sats pricing for skills (convert USD → sats via Saturn's exchange rate)
- [ ] Settlement flow between Saturn and SkillMart

### Phase 4: BYOK execution mode
- [ ] Encrypted key vault for customer provider credentials
- [ ] BYOK execution path (Saturn enforces policy, customer account executes)
- [ ] Same capability interface regardless of execution mode
- [ ] Enterprise `email` and `sms` via BYOK

### Phase 5: Open capability marketplace
- [ ] Third-party providers register capabilities on Saturn
- [ ] Provider-defined pricing
- [ ] Revenue split (platform fee + provider payout)
- [ ] Capability health monitoring and SLA tracking
- [ ] Provider dashboard for analytics and payouts

---

## Open Questions

1. **Routing intelligence**: How smart should Saturn's provider selection be in v1? Simple cost-based routing is enough to start. Quality-aware routing (latency, error rates, output quality) is a v2 concern.

2. **Model override scope**: Should agents be able to override the provider for any capability, or only `reason`? For v1, model override on `reason` only. Other capabilities have fewer meaningful provider choices.

3. **Auth delegation depth**: When APAAI integration is active, does Saturn validate APAAI tokens directly (JWT verification) or call APAAI's API on every request? JWT is faster, API call is simpler. Start with API call, optimize later.

4. **Policy evaluation latency**: Every call with APAAI governance requires a round-trip. For auto-approved calls this adds ~50-100ms. Acceptable for most use cases. Could cache policy decisions for repeated identical calls.

5. **Settlement currency**: Does SkillMart accept Lightning directly, or does Saturn settle in USD? Lightning-native is simpler but requires SkillMart to hold BTC.

6. **Capability taxonomy**: The 10 verbs in v1 are a starting point. As agent workloads evolve, new verbs will emerge (e.g., `store` for vector databases, `schedule` for calendar access, `pay` for financial transactions). The verb-based abstraction is extensible by design.

7. **Quality tiers**: When do we introduce `reason.fast` / `reason.deep` / `reason.cheap`? Not v1. The default routing should be good enough. Tiers add complexity and require agents to understand trade-offs they shouldn't need to think about yet.
