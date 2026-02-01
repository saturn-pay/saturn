# Saturn v1 Sprint Plan

Two-week sprints targeting v1 launch. Items marked with [x] are completed.

---

## Sprint 1: Capability Foundation

The goal of Sprint 1 is to establish the core capability abstraction --- the registry, the route, the database schema, and the policy enforcement. After this sprint, agents can make capability calls that are routed, authorized, and audited.

- [x] Create `capability-registry.ts` with 10 capability-to-provider mappings
- [x] Add `POST /v1/capabilities/:capability` route
- [x] Add `capability` column to `audit_logs`
- [x] Add `allowed_capabilities` / `denied_capabilities` to policies
- [x] Generate and run Drizzle migration
- [x] Update `policy.service.ts` for capability checks
- [x] Update `proxy-executor.ts` with capability field
- [x] Update `audit.service.ts` with capability field

**Status: Complete.**

---

## Sprint 2: Request/Response Normalization

The goal of Sprint 2 is to make capabilities truly agent-friendly. Agents should be able to call `search` or `reason` with a simple, consistent request shape and get back a consistent response shape --- regardless of which upstream provider handles the request.

- [ ] Build request normalizer per capability (agent-friendly request to provider-specific request)
- [ ] Build response normalizer per capability (provider-specific response to agent-friendly response)
- [ ] Add `GET /v1/capabilities` catalog endpoint (list available capabilities with pricing and status)
- [ ] Integration tests for all 10 capabilities (request in, normalized response out, audit logged)
- [ ] Health monitoring per capability (track provider availability, latency, error rates)

**Key decisions:**

- Request normalizers live alongside capability definitions in the registry.
- Response normalizers strip provider-specific metadata and return a uniform envelope: `{ result, usage, cost_sats, provider, latency_ms }`.
- The catalog endpoint is public (no auth required) so developers can discover capabilities before signing up.
- Health monitoring feeds into future capability routing decisions (failover, cost-optimized routing).

---

## Sprint 3: SDK + Docs

The goal of Sprint 3 is to make Saturn easy to adopt. The SDK should let developers call capabilities in one line of code. Documentation should cover every capability, integration path, and policy configuration.

- [x] Update SDK proxy resource with capability methods
- [x] Add capability request/response types to SDK
- [x] Add `CapabilitiesResource` to SDK
- [x] Update SDK tests
- [ ] Update PRD, ecosystem doc, `SKILL.md`
- [ ] Create `tech-spec.md` and `gtm.md`

**Key decisions:**

- SDK methods follow the capability-verb pattern: `saturn.capabilities.search(...)`, `saturn.capabilities.reason(...)`, etc.
- Types are generated from the capability registry to keep SDK and server in sync.
- Documentation updates include architecture diagrams and data flow descriptions.

**Status: SDK work complete. Documentation in progress.**

---

## Sprint 4: Polish + Launch Prep

The goal of Sprint 4 is to make Saturn production-ready and launch-ready. Every rough edge gets smoothed. The happy path works flawlessly. The README tells the whole story.

- [ ] End-to-end tests (fund wallet, call capability, verify audit log, check balance deduction)
- [ ] Seed script for capability catalog (populate database with all 10 capabilities, pricing, and provider config)
- [ ] Error messages and developer experience polish (clear error codes, actionable messages, helpful 4xx responses)
- [ ] Rate limiting per capability (protect upstream providers, enforce policy limits)
- [ ] README and quickstart guide (signup to first capability call in under 5 minutes)
- [ ] Docker Compose verified working (single command to run Saturn locally for development)

**Key decisions:**

- End-to-end tests run against a real local instance (Docker Compose) with test Lightning wallets.
- Seed script is idempotent and safe to run repeatedly.
- Error responses follow a consistent format: `{ error: { code, message, details } }`.
- Rate limiting is per-agent, per-capability, configurable via policies.
- README is the first thing a developer sees. It must convey what Saturn is, why it exists, and how to get started --- in under 2 minutes of reading.

---

## Timeline Summary

| Sprint | Focus | Duration | Status |
|--------|-------|----------|--------|
| Sprint 1 | Capability Foundation | 2 weeks | Complete |
| Sprint 2 | Request/Response Normalization | 2 weeks | Up next |
| Sprint 3 | SDK + Docs | 2 weeks | Partially complete |
| Sprint 4 | Polish + Launch Prep | 2 weeks | Not started |

Sprints 2 and 3 overlap in practice --- SDK work from Sprint 3 was pulled forward while Sprint 2 normalization work is scoped. Sprint 4 is a hard gate before public beta.
