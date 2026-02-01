# Saturn

**Agent-Native Payments & Economic Enforcement Layer**

## PRD — Board Overview

*Author: Product & Architecture*
*Status: Proposal (MVP-ready)*

---

## 1. Executive Summary

Saturn is infrastructure that enables **autonomous AI agents to transact real economic value safely and programmatically**, using Bitcoin over the Lightning Network.

As AI systems evolve from passive assistants into **autonomous agents**—capable of planning, executing tasks, and calling tools—the industry lacks a native way for agents to **spend money** without human accounts, credit cards, subscriptions, or identity.

Saturn fills this gap with two reinforcing layers:

1. **Payments & Enforcement Layer** — Agents hold balances, pay per action, under strict budgets and policies, with real-time settlement.
2. **Capability Layer** — Agents call simple verbs (`reason`, `search`, `read`, `execute`, etc.) and Saturn routes to the best backing provider internally—no API key management, no fiat billing, no provider selection required.

Saturn is:

* **Not a wallet app**
* **Not a marketplace**
* **Not a crypto product**

It is **infrastructure**—analogous to Stripe or AWS IAM—but designed for **non-human economic actors**.

---

## 2. The Problem

### 2.1 Agents Are Becoming Economic Actors

Modern agents already:

* Browse the web
* Call APIs
* Execute code
* Coordinate with other agents
* Make decisions autonomously

The next unavoidable step is **economic interaction**:

* Paying for data
* Paying for compute
* Paying for services
* Issuing bounties
* Hiring other agents

### 2.2 Existing Payment Systems Break Agent Autonomy

Today, teams rely on:

* Human-owned credit cards
* Stripe subscriptions
* OAuth + user accounts
* Manual billing reconciliation

These approaches fail because agents:

* Have no legal identity
* Cannot open bank accounts
* Do not fit subscription models
* Cannot be trusted with unlimited spend
* Cannot safely share human credentials

This creates a bottleneck where **autonomous systems still depend on humans to move money**, undermining autonomy, scalability, and safety.

### 2.3 The Supply-Side Gap

Even if agents could pay, **most services don't accept agent-native payments**. APIs are gated behind human accounts, credit card billing, and subscription tiers. There is no way for an agent to walk up to a service and pay per call without a pre-existing human relationship.

Saturn solves both sides: giving agents the ability to pay **and** giving them something to pay for on day one.

---

## 3. Why Bitcoin & Lightning (Design Rationale)

Bitcoin over Lightning is not a philosophical choice—it is a **systems constraint match**.

Lightning provides:

* Instant settlement
* Micropayments (sats)
* Programmatic invoices
* No chargebacks
* No identity or KYC
* Global, permissionless access

Critically:

* Agents do not need accounts
* Agents do not need trust
* Agents can reason about cost deterministically

No other payment rail satisfies these constraints today.

---

## 4. Product Definition

### 4.1 What Saturn Is

**Saturn is an agent-native payments and enforcement layer with a built-in capability routing system.**

It enables:

* Agents to hold spendable balances
* Agents to call capability verbs (reason, search, read, execute, etc.) and pay per call
* Teams to define hard economic limits
* Capabilities to enforce payment before execution
* Full auditability of agent spending
* Immediate access to 10 capability verbs backed by 15 providers from day one

### 4.2 What Saturn Is Not

Saturn explicitly does **not**:

* Compete with wallets
* Expose consumer UX
* Issue tokens
* Manage agent intent or reasoning
* Act as a full marketplace with discovery, ranking, or reviews

Saturn focuses on **economic enforcement and service access**, not cognition or curation.

---

## 5. Core Capabilities (MVP Scope)

### 5.1 Agent Wallets (Lightning)

* One Lightning wallet per agent
* Programmatic access via API keys
* Custodial for v1 (see Section 10 for custody strategy)
* Balance, pending payments, and receipts exposed via API

This provides agents with **real spendable value**, not simulated credits.

---

### 5.2 Spending Policies & Limits

Saturn enforces **hard constraints**, including:

* Max sats per call
* Max sats per day
* Allowed / denied destinations
* Maximum concurrent invoices
* Emergency kill switch per agent

Policies are enforced server-side and **cannot be bypassed by agents**.

---

### 5.3 Pay-to-Call Enforcement (L402-style)

Saturn introduces a simple rule:

> *No payment → no execution*

For paid services:

1. Agent requests action
2. Saturn issues a Lightning invoice
3. Payment settles
4. Request executes

This replaces:

* Subscriptions
* Trust-based billing
* Manual reconciliation

With **deterministic settlement**.

---

### 5.4 Capability Layer

Saturn exposes a **verb-based capability interface** to agents. Instead of selecting a vendor slug, agents call a capability verb (`reason`, `search`, `read`, etc.) and Saturn routes to the best available backing provider internally. This solves the supply-side cold-start problem while keeping the agent interface clean and provider-agnostic.

#### How It Works

```
Agent → capability verb (e.g. "search") → Saturn Gateway → [Policy + Payment] → Saturn routes to backing provider → Response to Agent
```

1. Saturn holds bulk/wholesale accounts with upstream API providers (fiat-denominated).
2. Saturn exposes each capability as a Lightning-payable endpoint at `/v1/capabilities/:capability` (e.g., `/v1/capabilities/search`).
3. When an agent calls a capability, Saturn:
   - Resolves the capability verb to the best available backing provider (based on cost, latency, and availability)
   - Checks spending policies
   - Charges the agent's wallet in sats (at Saturn's published rate)
   - Calls the upstream API using Saturn's own credentials
   - Returns the result to the agent
4. The agent never touches API keys, OAuth, fiat billing, or provider names.
5. Agents may optionally specify a provider override if they need a specific backing provider (e.g., `"provider": "anthropic"` on a `reason` call), but this is not required.

> **Backward compatibility:** The legacy proxy route `/v1/proxy/:serviceSlug` remains available for existing integrations but is considered deprecated. New integrations should use the capability endpoint.

#### The Spread Model

Saturn's margin comes from the **spread between wholesale fiat cost and retail sats price**.

Example — `search` capability (backed by Serper):

| | |
|---|---|
| Serper cost to Saturn | ~$0.001 per query (bulk plan) |
| Saturn price to agent | ~$0.0015 per query (in sats at market rate) |
| **Gross margin** | **~33%** |

Example — `reason` capability (backed by OpenAI GPT-4o):

| | |
|---|---|
| OpenAI cost to Saturn | ~$0.005 per 1K output tokens |
| Saturn price to agent | ~$0.007 per 1K output tokens (in sats) |
| **Gross margin** | **~28%** |

The spread is justified because Saturn provides:

* Zero API key management for the agent operator
* Per-call granularity (no monthly minimums)
* Automatic provider routing and failover
* Budget enforcement and audit trail included
* Instant Lightning settlement (no invoicing, no net-30)
* A single integration point for multiple capabilities

Agents pay slightly more per call but eliminate all billing complexity, credential management, provider selection, and overspend risk. For teams running dozens of agents across multiple capabilities, this is a net cost reduction.

#### Sats Pricing Mechanics

* Saturn publishes a **sats price list** per capability, updated periodically based on upstream cost + BTC/USD rate.
* Prices are quoted in sats at request time (deterministic — the agent knows exactly what it will pay before committing).
* Saturn absorbs FX risk within the update window. Margins are set wide enough to buffer normal volatility.
* For high-volume customers, Saturn can offer locked rates via pre-funded balances.

---

### 5.5 Launch Capabilities (MVP Capability Catalog)

Saturn launches with **10 capability verbs**, each backed by one or more upstream providers. Agents call the verb; Saturn routes to the best provider. The 15 backing providers are selected based on: (a) high usage by existing AI agents, (b) simple per-call pricing from the upstream provider, (c) clear value to autonomous workflows.

#### Capability Verb Reference

| # | Capability Verb | What It Does | Backing Providers | Why Agents Need It |
|---|----------------|-------------|-------------------|-------------------|
| 1 | **`reason`** | LLM inference and reasoning | OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude) | Subtasks, summarization, classification, multi-model strategies |
| 2 | **`search`** | Web search results | Serper, Brave Search API | Web research, fact-checking, real-time data retrieval |
| 3 | **`read`** | URL → clean structured content | Jina AI Reader, Firecrawl | Parsing web content for LLM consumption |
| 4 | **`scrape`** | Web scraping & crawling | Firecrawl, ScraperAPI | Extracting structured data from websites, anti-bot bypass |
| 5 | **`execute`** | Sandboxed code execution | E2B | Running code safely (data analysis, testing) |
| 6 | **`email`** | Transactional email | Resend | Notifications, reports, outreach |
| 7 | **`sms`** | SMS messaging | Twilio | Notify humans, trigger SMS-based workflows |
| 8 | **`imagine`** | Image/video/audio generation | Replicate | Generating or processing media |
| 9 | **`speak`** | Text-to-speech | ElevenLabs | Voice generation for content, accessibility, telephony agents |
| 10 | **`transcribe`** | Speech-to-text | Deepgram | Transcription for meeting agents, voice pipelines |

#### Additional Backing Providers

The following providers are available through the capability layer but do not map to a dedicated verb at launch. They are accessible via provider override or are integrated into existing capabilities:

| Provider | Accessible Via | Notes |
|----------|---------------|-------|
| **Pinecone** | Provider override | Vector database for RAG workflows, semantic search, memory |
| **Hunter.io** | Provider override | Email finding & verification for lead gen agents |

#### Provider Routing

When an agent calls a capability verb, Saturn selects the backing provider based on:

* **Cost** — lowest cost option within the capability
* **Latency** — fastest response time based on recent measurements
* **Availability** — current health and rate-limit headroom of each provider
* **Agent preference** — optional provider override in the request body

Example: an agent calls `search`. Saturn routes to Serper by default. If Serper is rate-limited or degraded, Saturn automatically fails over to Brave Search API. The agent sees a consistent interface regardless.

#### Expansion Strategy

After launch, new capabilities and backing providers are added based on:

* Agent usage data (what verbs are agents calling most? what verbs are missing?)
* Community requests
* Upstream API simplicity (per-call billing preferred)

New backing providers can be added to existing verbs without any agent-side code changes. Adding a new capability verb requires a minor SDK update.

Long-term, Saturn opens a **Capability Registry** — a protocol-level directory (not a marketplace) where third-party providers can register as backing providers for existing capability verbs or propose new verbs. Think DNS for agent capabilities, not an app store.

---

### 5.6 Bring Your Own Key (BYOK)

> **Phase 2 feature.** Not included in MVP scope.

Some teams already hold direct API keys with upstream providers and want to use Saturn purely for budget enforcement, audit, and the capability routing interface—without paying Saturn's proxy spread.

In Phase 2, Saturn will support BYOK mode:

* Teams register their own API keys for specific providers
* Saturn still enforces spending policies and logs all calls
* Saturn routes through the team's own credentials instead of Saturn's wholesale accounts
* Saturn charges a smaller **platform fee** (lower than the proxy spread) for policy enforcement and audit
* Capability routing, failover, and the verb interface work identically

BYOK gives teams a migration path: start with Saturn's managed credentials at launch, bring your own keys later as volume grows and direct contracts make economic sense.

---

### 5.7 APAAI Governance Integration

Saturn is designed to align with emerging **Autonomous and Purpose-driven AI Agent Infrastructure (APAAI)** governance standards for agent economic activity.

Key integration points:

* **Spend attestation** — Every capability call produces a cryptographically verifiable receipt that can be submitted to external governance frameworks
* **Policy interoperability** — Saturn's spending policies can import and enforce external governance rules (e.g., maximum spend per task category, prohibited capability usage)
* **Agent identity anchoring** — Saturn's agent wallet identity can serve as an economic identity anchor for cross-platform governance
* **Audit export** — Full audit trails are exportable in structured formats for compliance review by governance bodies

As APAAI standards mature, Saturn will implement protocol-level compliance so that agents operating under governance frameworks can transact through Saturn with automatic policy enforcement.

---

### 5.8 Audit & Observability

Every economic action produces:

* A quote (sats price at request time)
* A policy decision (allowed/denied + reason)
* A payment invoice
* A settlement proof
* A service execution record (upstream response metadata)

This enables:

* Cost attribution per agent, per capability, per task
* Budget forecasting
* Forensic audit
* Enterprise reporting

---

## 6. Architecture Overview

### 6.1 Logical Stack

```
Agent Runtime (LLM, planner, tools)
        ↓
Saturn SDK (capability verbs: reason, search, read, execute, ...)
        ↓
Saturn Gateway (capability routing + policy + payment)
        ↓
Lightning Network (settlement)
        ↓
Backing Provider (selected by Saturn based on capability verb)
```

Saturn acts as a **capability router and economic gatekeeper**, not a controller. Agents express intent through verbs; Saturn handles provider selection, payment, and enforcement.

### 6.2 Capability Routing Architecture

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌─────────────┐
│   Agent      │────▶│  Saturn Gateway                       │────▶│  Backing     │
│   Runtime    │     │                                      │     │  Providers   │
│              │     │  1. Resolve capability verb           │     │              │
│  calls verb: │◀────│  2. Select best backing provider     │◀────│  (OpenAI,    │
│  "search"    │     │  3. Policy check                     │     │   Anthropic, │
│              │     │  4. Sats invoice + settlement        │     │   Serper,    │
│              │     │  5. Upstream call (Saturn credentials)│     │   Firecrawl, │
│              │     │  6. Response relay + audit log       │     │   etc.)      │
└─────────────┘     └──────────────────────────────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Audit Log   │
                    │  (per agent, │
                    │  per capability│
                    │   per call)  │
                    └──────────────┘
```

#### Capability Flow Example

```
Agent calls: POST /v1/capabilities/search { "query": "latest AI news" }
                                    ↓
                        Saturn resolves "search" verb
                                    ↓
                    Provider selection: Serper (primary), Brave (fallback)
                                    ↓
                        Policy check → spending limit OK
                                    ↓
                        Lightning invoice → payment settles
                                    ↓
                    Saturn calls Serper API with Saturn's credentials
                                    ↓
                        Response returned to agent
```

---

## 7. Target Customers (Initial ICP)

### Primary ICP

* AI SaaS companies (2–15 engineers)
* Building autonomous or semi-autonomous agents
* Already paying for LLMs and APIs
* Experiencing cost control and billing complexity
* Managing multiple API keys across services

### Buyer Personas

* Founder / CTO
* Platform / Infra Lead
* DevEx / Systems Architect

These teams want:

* Faster shipping
* Less billing logic, API key sprawl, and provider selection overhead
* Clear cost boundaries per agent
* A single integration point via capability verbs
* Agent-safe payments

---

## 8. Monetization Strategy

### Pure Usage-Based (No Subscriptions)

Saturn charges **zero upfront fees**. Revenue comes from usage.

#### Revenue Layer 1: Capability Spread (Primary — MVP)

Saturn buys upstream API access at bulk/wholesale rates and resells per-capability-call to agents at a markup in sats.

* Typical gross margin: **25-40%** depending on capability and backing provider
* Justified by: zero key management, automatic provider routing, per-call granularity, budget enforcement, audit trail, single integration
* This is where early revenue comes from

#### Revenue Layer 2: Transaction Fee on Direct Payments

When agents pay third-party Saturn-compatible services directly (not through the capability layer), Saturn takes a small routing/enforcement fee.

* **1-3%** on transaction value
* Covers: policy enforcement, settlement, audit logging
* This is where scale revenue comes from as the network grows

#### Revenue Layer 3: Enterprise Throughput & Guarantees

For high-volume customers:

* Volume-based rate negotiation (lower % at committed throughput)
* Dedicated Lightning liquidity
* Custom policies and compliance exports
* SLA guarantees

No feature gates. Everyone gets the full product. Enterprise pays for **throughput and operational guarantees**, not access.

### Why Not SaaS Subscriptions

* Saturn is payments infrastructure. Charging a subscription to access a payment system adds friction on top of friction.
* The value scales with usage, not seat count or agent count. Flat tiers penalize light users and subsidize heavy ones.
* Zero-commitment onboarding maximizes experimentation and adoption.
* Revenue aligns with customer success: Saturn earns when agents transact.

### Summary

| Tier | How it works | Saturn revenue |
|------|-------------|----------------|
| **Default** | Free to start. Pay per capability call. | 25-40% spread on capability calls |
| **Direct payments** | Third-party services accept Lightning via Saturn | 1-3% transaction fee |
| **High volume** | Negotiate lower rates at committed scale | Volume commitment + lower % |
| **Enterprise** | Dedicated infra + SLA + compliance | Base fee + reduced rates |

The pitch: **"Plug in, fund your agents, pay only for what they use."**

---

## 9. Why This Is Defensible

### Technical Defensibility

* Operational complexity (Lightning liquidity management, reliability)
* Policy + payment enforcement correctness at scale
* Multi-provider capability routing with rate management and FX buffering
* Deep agent-runtime integration

### Strategic Defensibility

* Early positioning in agent-native economics
* Hard to retrofit into legacy payment stacks
* High switching cost once agents are wired to Saturn capability verbs
* Capability layer creates lock-in: agents integrate once with verbs, Saturn manages upstream provider relationships
* Aggregated upstream buying power improves margins over time

### Market Timing

* Agent adoption accelerating
* Tool-calling becoming standard across all major LLM providers
* No dominant solution exists today
* API cost management is an active pain point for every team running agents

---

## 10. Risks & Mitigations

### Risk: "Too early" — agents don't spend money yet

Mitigation:

* The capability layer provides **immediate value** even without agent-to-agent payments. Teams already spend on OpenAI, Serper, etc. Saturn consolidates that spend under budget controls with a cleaner verb-based interface.
* Start with internal / B2B agent use cases where API spend is already happening.
* Focus on infra buyers, not consumers.

### Risk: "Crypto skepticism"

Mitigation:

* Frame as *payments infrastructure*, not crypto.
* Emphasize Lightning as transport, not ideology.
* Agents and operators interact with sats balances and per-call pricing — not blockchain concepts.

### Risk: Custody concerns

Saturn holds agent balances (custodial in v1). This triggers potential money transmitter obligations.

Mitigation:

* Legal analysis of MSB/MTL requirements in target jurisdictions before launch.
* Scope MVP to jurisdictions with clearer regulatory frameworks or operate under an existing licensed partner.
* Custodial v1 → non-custodial / NWC (Nostr Wallet Connect) in v2, reducing custody exposure.
* Clear security boundaries: kill switches, maximum balance caps, withdrawal limits.
* Consider structuring agent balances as prepaid credits (not deposits) to reduce regulatory surface.

### Risk: FX / volatility on the spread

Mitigation:

* Sats prices updated on a regular cadence (e.g., every 15 minutes).
* Margins set wide enough to absorb normal BTC/USD volatility within update windows.
* High-volume customers can pre-fund at locked rates.
* Saturn does not speculate — incoming sats can be converted to fiat immediately to neutralize exposure.

### Risk: Upstream API dependency

Mitigation:

* No exclusivity with any upstream provider.
* Multiple backing providers per capability verb (e.g., Serper + Brave for `search`).
* Capability catalog is additive — losing one provider triggers automatic failover to another backing the same verb.

---

## 11. Roadmap

### Phase 1 — MVP

* Agent wallets (custodial, Lightning)
* Spending policies & limits
* Pay-to-call enforcement (L402-style)
* Capability layer with 10 launch verbs backed by 15 providers
* Capability routing (cost, latency, availability)
* SDK (Python, TypeScript)
* Audit log & dashboard
* APAAI governance integration (spend attestation, audit export)

### Phase 2 — Expansion

* BYOK (Bring Your Own Key) support for teams with existing provider contracts
* Capability Registry: protocol-level directory where third-party providers register as backing providers for capability verbs
* Non-custodial wallet support (NWC)
* Advanced capability routing (agent specifies intent constraints, Saturn optimizes across providers)
* Webhook integrations for spend alerts

### Phase 3 — Network Effects

* Agent-to-agent payments (agents hiring other agents)
* Bounty primitives (post task + reward, any agent can claim)
* Reputation scores based on payment history
* Cross-platform agent identity (portable economic history)

---

## 12. Success Metrics (MVP)

* Time-to-integrate < 1 day
* First paying customer (real sats flowing) within 30–60 days
* Total sats volume through capability calls in month 1
* Number of unique agents transacting per week
* Gross margin on capability spread > 25%
* Zero uncontrolled overspend incidents
* Repeat usage rate (agents that transact in week 1 and week 4)

---

## 13. Recommendation

Proceed with Saturn as:

* A **standalone product**
* A **usage-based, zero-commitment model**
* A **payments + capability wedge** — solve both the payment problem and the supply-side cold start simultaneously

Saturn creates:

* Immediate revenue through capability spread on verbs agents already need (reason, search, read, etc.)
* A growing network of agent-callable capabilities backed by best-in-class providers
* A foundation for future agent economies (bounties, agent-to-agent hiring, capability registry)

This is **plumbing**, not a bet on narratives—and plumbing compounds.
