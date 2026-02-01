# Saturn

**The execution and payment layer for autonomous AI agents.**

---

## The Problem

AI agents are moving from demos to production. They need to think, search, execute code, send emails, and get real work done — autonomously, without a human in the loop.

Today, giving an agent access to paid services means handing it raw API keys with no spending controls, no per-agent budgets, no kill switch, no audit trail, and no way to stop a runaway loop before it drains an account. There is no safe way to let an agent spend money.

---

## What Saturn Does

Saturn gives every AI agent a wallet and a set of capabilities — priced per use, enforced by policy, paid in Bitcoin (Lightning Network).

Agents don't manage API keys. They call capabilities:

| Capability | What the agent does |
|------------|-------------------|
| **Reason** | Think, plan, write, generate code |
| **Search** | Find current information on the web |
| **Read** | Turn URLs into clean, structured text |
| **Execute** | Run code in a secure sandbox |
| **Email** | Send transactional messages |
| + 5 more | Scrape, SMS, image gen, text-to-speech, transcription |

Saturn handles everything else: routing to the best provider, authenticating upstream, billing per call, enforcing budgets, and producing a receipt for every action.

---

## Key Insight: Capabilities, Not APIs

Saturn does not resell API access. It sells agent actions.

Agents see: `reason`, `search`, `read`, `execute`. Agents don't see: OpenAI, Anthropic, Serper, Firecrawl. Providers are implementation details that Saturn manages internally.

If a provider raises prices, degrades, or goes down — Saturn reroutes. Agent code never changes.

This gives Saturn **routing leverage** (control over where traffic goes), **margin control** (Saturn prices capabilities, not pass-through calls), and **legal clarity** (Saturn is a product, not a reseller).

---

## How Money Flows

```
Operator funds agent wallet (sats via Lightning)
  ↓
Agent calls a Saturn capability ("reason", "search", "read")
  ↓
Saturn checks policy → routes to best provider → charges sats
  ↓
Result returns to agent. Receipt logged. Balance updated.
```

The agent pays in sats. Saturn pays providers. Saturn keeps the spread.

**Saturn doesn't charge to sign up. Doesn't charge monthly. Makes money every time an agent does something.**

---

## Revenue

| Layer | When | How |
|-------|------|-----|
| **Capability spread** | Day 1 | Agent pays 50 sats per call. Saturn pays provider ~35 sats. ~30% margin. |
| **BYOK platform fee** | Enterprise | Customers connect their own provider accounts. Pay Saturn for policy enforcement and receipts. |
| **Capability marketplace** | At scale | Third-party providers list capabilities on Saturn. Saturn takes a platform cut. |
| **SkillMart settlement** | Phase 3 | Saturn processes knowledge purchases from the SkillMart marketplace. Transaction fee. |

Revenue scales linearly with agent activity. More agents, more calls, more revenue.

---

## The Ecosystem

Saturn is part of a three-product stack:

| Product | Role |
|---------|------|
| **APAAI** | Governance — defines what agents are allowed to do. Policy engine, human-in-the-loop approval, evidence trail. Open protocol. |
| **Saturn** | Execution — enforces those rules with real money. Wallets, routing, billing, kill switch. |
| **SkillMart** | Knowledge — marketplace for structured decision frameworks (SKILL.md). Agents discover and purchase skills through Saturn. |

APAAI defines the rules. Saturn makes it impossible to break them. SkillMart supplies the knowledge agents need to operate.

Each product works independently but becomes significantly more powerful together.

---

## Why Lightning

- **Micropayments work.** A single agent call costs 5-50 sats (~$0.005-$0.05). Credit card minimums make this impossible with fiat.
- **Instant settlement.** Seconds, not days.
- **No chargebacks.** Funded wallets are committed money.
- **Global by default.** No bank accounts, no country restrictions.
- **Programmable.** Native to software. No payment forms, no PCI compliance.

---

## Why Customers Pay (And Don't Care About The Markup)

A team running 20 agents across 5 APIs currently manages 5 separate accounts, 5 sets of API keys, custom spend tracking code, and monthly invoices that don't break down by agent.

With Saturn: one integration, one wallet, one dashboard. Hard budget limits per agent. Full audit trail. Kill switch. The markup disappears into operational savings.

---

## What Makes It Stick

Once agents are wired through Saturn, switching means rewriting every integration, rebuilding budget enforcement, losing the audit trail, and managing API keys again. This is infrastructure lock-in — the same reason teams don't leave Stripe or AWS once embedded.

---

## Current Status

- **Server:** fully implemented (Node.js, TypeScript, PostgreSQL, Lightning)
- **SDK:** shipped (`@saturn-pay/sdk`, full TypeScript, capability-verb interface)
- **Capabilities:** 10 capability verbs, 15 upstream providers, capability routing live
- **Architecture:** capability-verb model implemented, `POST /v1/capabilities/:capability` active alongside legacy `/v1/proxy/:slug`

**What's live:**
- Capability registry: `reason`, `search`, `read`, `scrape`, `execute`, `email`, `sms`, `imagine`, `speak`, `transcribe`
- Capability policy enforcement (allow/deny per capability)
- Capability audit logging
- SDK capability methods (`saturn.proxy.reason()`, `saturn.proxy.search()`, etc.)
- Capabilities catalog endpoint (`GET /v1/capabilities`)

**Next milestones:**
1. Request/response normalization per capability
2. APAAI governance integration
3. SkillMart as a Saturn capability
4. BYOK for enterprise customers
5. Open capability marketplace

---

## Team

[Team info]

---

## Ask

[Raise details]
