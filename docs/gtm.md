# Saturn Go-To-Market Strategy

## Positioning

**Saturn is the execution and payment layer for autonomous AI agents.**

Saturn gives AI agents wallets (Bitcoin Lightning), capability-verb API access (`reason`, `search`, `read`, `execute`, etc.), and spending policies. Agents pay per call in satoshis.

Saturn is not a crypto product. It is not a wallet app. It is infrastructure --- the missing layer between AI agents and the services they need to do real work.

---

## Target Audience

**Primary: AI SaaS teams (2--15 engineers) building autonomous agents.**

These teams share a common profile:

- Already paying for LLMs and APIs (OpenAI, Anthropic, Google, etc.)
- Managing multiple API keys, rate limits, and billing dashboards
- Building agents that need to take actions: search the web, read documents, write code, execute tasks
- Frustrated by the operational overhead of wiring up and monitoring dozens of provider integrations
- Looking for a single interface that lets their agents act autonomously within defined guardrails

**Why they care about Saturn:**

1. **One API, many capabilities.** Replace a dozen provider integrations with a single capability-verb interface.
2. **Per-call economics.** No subscriptions, no commitments. Agents pay only when they transact.
3. **Spending policies.** Define budgets, allowed capabilities, and rate limits per agent --- not per developer.
4. **Audit trail.** Every capability call is logged with cost, latency, provider, and result.

---

## Pricing Communication

Saturn's pricing model is designed around transparency and simplicity:

- **Free to sign up.** No credit card required. No trial period.
- **Pay only when agents transact.** Funding happens via Lightning wallet top-ups.
- **Transparent per-capability pricing in sats.** Every capability has a clearly listed cost.
- **~25--40% spread over upstream cost.** Saturn's margin is built into the per-call price. No hidden fees.
- **No subscriptions, no commitments.** Scale up or down with zero friction.

Pricing is communicated in satoshis (sats) to align with Lightning micropayment semantics. For teams unfamiliar with sats, documentation includes USD-equivalent examples at current exchange rates.

---

## Onboarding Flow

The target onboarding experience is under five minutes from signup to first capability call:

1. **Sign up.** Email and password. No credit card.
2. **Create an agent.** Name it, assign a policy (or use the default).
3. **Fund the wallet.** Deposit sats via Lightning invoice (scan QR or paste invoice into any Lightning wallet).
4. **Make the first capability call.** `POST /v1/capabilities/search` with a query. See the result, the cost in sats, and the audit log entry.

Every step is available through both the API and the dashboard. The SDK provides helper methods for the entire flow.

---

## Launch Channels

### Developer Communities

- **Twitter/X**: Share technical threads on agent economics, capability routing, and Lightning micropayments. Engage with AI agent builders and Lightning developers.
- **Discord**: Maintain a Saturn community server for support, feedback, and early adopter discussions. Participate in LangChain, CrewAI, and AutoGen community servers.
- **Hacker News**: Launch posts for private beta and public beta. Technical deep-dives as Show HN posts.

### AI Agent Framework Integrations

Native integrations and published plugins for:

- **LangChain** --- Tool and callback integration
- **CrewAI** --- Agent tool provider
- **AutoGen** --- Function call integration
- **Semantic Kernel** --- Plugin connector

These integrations are both a distribution channel and a trust signal. Being listed in framework documentation puts Saturn in front of every team evaluating agent tooling.

### Developer Conferences and Meetups

- AI engineer meetups and conferences (AI Engineer Summit, local AI/ML meetups)
- Bitcoin and Lightning conferences (developer-focused talks on micropayment infrastructure)
- Hackathons as a sponsor or challenge provider ("Build an autonomous agent with a budget")

### Technical Blog Posts

Publish consistently on agent economics and infrastructure topics (see Content Strategy below).

---

## Content Strategy

All content serves one goal: establish Saturn as the obvious infrastructure choice for teams building autonomous agents.

### Technical Blog Posts

- **Agent economics**: How much does it cost to run an autonomous agent? Break down real-world cost profiles.
- **Capability routing**: How Saturn selects the best provider for each capability call (latency, cost, reliability).
- **Lightning micropayments for AI**: Why Bitcoin Lightning is the right payment rail for agent-to-service transactions.
- **Spending policies**: How to give agents autonomy without giving them a blank check.

### Integration Guides

Step-by-step guides for connecting Saturn to popular agent frameworks:

- "Add Saturn capabilities to your LangChain agent"
- "Give your CrewAI crew a wallet and a budget"
- "Connect AutoGen agents to real-world services via Saturn"

### Tutorials

- **"Build an agent in 10 minutes"**: From zero to a working agent that can search, read, and reason --- with a funded wallet and spending policy.
- **"Your first capability call"**: The simplest possible example. One API call, one result, one audit log entry.
- **"Agent budgeting 101"**: Set up policies that let agents work autonomously within defined limits.

### API Documentation and Interactive Playground

- Complete API reference with request/response examples for every capability
- Interactive playground where developers can make capability calls and see results in real time
- SDK documentation with TypeScript examples

---

## Partnerships

### Agent Framework Maintainers

- **LangChain, CrewAI, AutoGen, Semantic Kernel**: Co-develop integrations, get listed in official documentation, co-author blog posts and tutorials.

### Lightning Wallet Providers

- **Alby, Phoenix, Zeus**: Ensure smooth funding experience. Co-promote to Lightning-native users who are exploring AI agent use cases.

### AI Infrastructure Companies

- **E2B** (code execution): Saturn routes `execute` capability calls to E2B sandboxes.
- **Firecrawl** (web scraping): Saturn routes `read` and `scrape` capability calls to Firecrawl.
- **Jina** (search and embeddings): Saturn routes `search` and `embed` capability calls to Jina.

These partnerships are both technical (provider integrations) and commercial (co-marketing, shared customers).

---

## Launch Milestones

### Private Beta

- **Audience**: 5--10 handpicked teams, selected for diversity of agent use cases.
- **Support**: Direct Slack/Discord channel with the founding team. Weekly check-ins.
- **Goal**: Validate the capability abstraction, onboarding flow, and pricing model. Collect feedback on developer experience, missing capabilities, and policy flexibility.
- **Success criteria**: At least 3 teams making regular capability calls in production-like workflows.

### Public Beta

- **Audience**: Open signups. Self-serve onboarding.
- **Requirements**: Documentation complete. SDK published. All 10 launch capabilities stable.
- **Support**: Community Discord, documentation, and email support.
- **Goal**: Scale to 50+ teams. Validate self-serve onboarding without hand-holding.
- **Success criteria**: New teams can go from signup to first capability call in under 5 minutes without contacting support.

### General Availability (GA)

- **Production SLA**: Uptime guarantees, latency targets, and incident response commitments.
- **Enterprise features**: Team management, role-based access, SSO, custom policies, dedicated support.
- **BYOK (Bring Your Own Keys)**: Teams can plug in their own provider API keys for capabilities where they have existing relationships or negotiated pricing. Saturn still handles routing, auditing, and policy enforcement.
- **Goal**: Saturn is the default infrastructure layer for teams building autonomous agents.
