---
id: saturn-service-consumer
name: Saturn Service Consumer
version: 1.0.0
area: Engineering
category: ai-agent-infrastructure
price: 0
affiliate_commission: 0
description: Teaches an agent how to discover, evaluate, and consume API services through the Saturn payment network
inputs:
  - task-description
  - saturn-api-key
  - budget-constraints
outputs:
  - service-selection
  - api-call-result
  - spend-report
tags:
  - saturn
  - api-proxy
  - lightning
  - agent-autonomy
  - service-discovery
author: Saturn
allowed-tools:
  - Read
  - Bash
context: inline
---

# Saturn Service Consumer

## What this does

Guides an AI agent through discovering available API capabilities on the Saturn network, evaluating pricing and fitness for a given task, executing calls with budget awareness, and reporting on spend. The agent learns to operate autonomously within policy and balance constraints.

## When to use it

- When an agent needs to call an external API (LLM, search, email, scraping, etc.) and has a Saturn wallet
- When an agent must choose between multiple providers for the same capability (e.g., `reason` can route to OpenAI or Anthropic)
- When an agent needs to stay within a budget or respect policy limits while completing work
- When building an agent workflow that chains multiple paid API calls

## When NOT to use it

- When the agent already has direct API keys for services (no need for Saturn proxy)
- When the task requires no external API calls
- When the agent has no Saturn API key or wallet balance
- When the capability needed is not available on the Saturn network

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| task-description | string | yes | What the agent needs to accomplish (e.g., "summarize this document", "search for competitors") |
| saturn-api-key | string | yes | Agent API key (`sk_agt_...`) with funded wallet |
| budget-constraints | object | no | Optional limits: `{ maxPerCallSats, maxTotalSats }` |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| service-selection | object | Which capability and provider was chosen and why: `{ capability, provider, operation, priceSats, reason }` |
| api-call-result | object | The upstream API response data |
| spend-report | object | Sats spent: `{ quotedSats, chargedSats, balanceAfter }` |

## Constraints

- Agent must have a funded Saturn wallet before making calls
- Policy limits (kill switch, allowed/denied services, per-call max, daily max) are enforced server-side — the agent cannot bypass them
- Capability calls are POST-only to `/v1/capabilities/:verb`
- Legacy proxy calls to `/v1/proxy/:serviceSlug` still work for backward compatibility
- Request body must match the expected format for the capability (or the upstream service's native format when using legacy proxy)
- Budget tracking is the agent's responsibility — Saturn charges per call but does not enforce client-side budgets

## Assumptions

- The Saturn API is reachable at the configured `baseUrl`
- The agent key is valid and the associated wallet has sufficient balance
- The agent can parse JSON responses from upstream services
- Capabilities listed on `/v1/capabilities` are operational

## Step-by-step logic

### Phase 1: Initialize and check wallet

1. Create a Saturn client with the agent key:
   ```
   GET /v1/wallet
   Authorization: Bearer sk_agt_...
   ```
2. Read `balanceSats` from the response
3. If balance is 0, STOP — request funding via `POST /v1/wallet/fund` or notify the operator
4. Note the available balance for budget tracking

### Phase 2: Discover available capabilities

5. Fetch the capability catalog:
   ```
   GET /v1/capabilities
   ```
   This returns capabilities with descriptions, supported providers, and pricing. The legacy `GET /v1/services` endpoint also still works and returns services by vendor slug.

6. Parse the response into a list of capabilities with their verbs, descriptions, providers, and pricing
7. For each capability, note:
   - `verb` — the identifier used in capability calls (e.g., `reason`, `search`, `scrape`)
   - `description` — what the capability does
   - `providers` — which upstream services back this capability
   - `pricing` — array of operations with `priceSats` per unit

### Phase 3: Select the right capability for the task

8. Map the task to a capability:
   - **Text generation / reasoning** → `reason` (routes to GPT-4o, Claude, etc.)
   - **Web search** → `search` (routes to Serper, Brave Search, etc.)
   - **Web scraping / reading** → `read` or `scrape` (routes to Firecrawl, Jina, etc.)
   - **Email sending** → `email`
   - **SMS sending** → `sms`
   - **Image generation** → `imagine`
   - **Speech synthesis (TTS)** → `speak`
   - **Speech recognition (STT)** → `transcribe`
   - **Code execution** → `execute`

9. If multiple providers back the same capability, compare on:
   - **Price per call** — check `priceSats` for the specific operation
   - **Model availability** — does the provider support the exact model needed?
   - **Budget fit** — can the agent afford the call given remaining balance?

10. Select the capability (and optionally a preferred model/provider). If the best option exceeds budget, fall back to a cheaper alternative or STOP.

### Phase 4: Construct and execute the capability call

11. Build the request body matching the capability's expected format. Examples:

    **Reason (text generation):**
    ```json
    POST /v1/capabilities/reason
    {
      "messages": [{"role": "user", "content": "Summarize this document..."}],
      "model": "gpt-4o"
    }
    ```

    **Search (web search):**
    ```json
    POST /v1/capabilities/search
    {
      "query": "bitcoin price"
    }
    ```

    **Read (web scraping):**
    ```json
    POST /v1/capabilities/read
    {
      "url": "https://example.com/article"
    }
    ```

    **Legacy proxy (backward compatible):**
    ```json
    POST /v1/proxy/openai
    {
      "model": "gpt-4o-mini",
      "messages": [{"role": "user", "content": "..."}],
      "max_tokens": 1000
    }
    ```

12. Send the request with the agent key in the Authorization header
13. Read the response headers for spend and routing metadata:
    - `X-Saturn-Audit-Id` — unique call identifier
    - `X-Saturn-Capability` — the capability verb that was invoked (e.g., `reason`)
    - `X-Saturn-Provider` — the upstream provider that handled the request (e.g., `openai`)
    - `X-Saturn-Quoted-Sats` — amount quoted before execution
    - `X-Saturn-Charged-Sats` — amount actually charged
    - `X-Saturn-Balance-After` — wallet balance after this call

14. Parse the response body — this is the raw upstream service response

### Phase 5: Handle errors

15. Check the HTTP status code:
    - **200** — success, proceed with the response data
    - **402 (INSUFFICIENT_BALANCE)** — wallet is empty, stop and request funding
    - **403 (POLICY_DENIED)** — policy blocks this call (kill switch, service not allowed, daily limit hit). Read the error message for the specific reason. Do NOT retry — the policy is enforced by the operator.
    - **502 (UPSTREAM_ERROR)** — the external service failed. May retry once after a brief pause.
    - **429 (RATE_LIMIT)** — too many requests. Wait 60 seconds and retry.

### Phase 6: Track spend and report

16. Update the running spend total: `totalSpent += chargedSats`
17. Update remaining budget: `remaining = budgetMax - totalSpent`
18. If the task requires additional calls (e.g., multi-step workflow), return to Phase 4
19. Before each subsequent call, verify `remaining >= estimatedCostSats` for the next operation
20. When the task is complete, compile the spend report:
    ```
    {
      "callsMade": 3,
      "totalQuotedSats": 150,
      "totalChargedSats": 140,
      "balanceAfter": 9860,
      "capabilityBreakdown": [
        { "capability": "search", "provider": "serper", "calls": 1, "sats": 5 },
        { "capability": "reason", "provider": "openai", "calls": 2, "sats": 135 }
      ]
    }
    ```

## Failure modes

| Failure | Symptoms | Cause |
|---------|----------|-------|
| Empty wallet | 402 error on first call | Wallet was never funded or has been drained |
| Policy denial | 403 error with reason string | Operator set kill switch, service deny list, or spending limit |
| Wrong request format | 400 or 502 from upstream | Request body doesn't match the capability's expected format |
| Service unavailable | 502 with upstream error details | External service is down or experiencing issues |
| Rate limited | 429 with Retry-After header | Agent exceeded 60 req/min on proxy routes |
| Budget exceeded | Agent-side check fails | Total spend would exceed the caller's budget constraint |
| Invalid API key | 401 error | Key is wrong, revoked, or uses account key instead of agent key |

## What to do if it fails

- **Empty wallet**: Call `POST /v1/wallet/fund` with desired `amountSats` (min 1,000, max 10,000,000). This returns a Lightning invoice. Pay it to credit the wallet, then retry.
- **Policy denial**: Do NOT retry. Report the denial reason to the operator. The agent cannot override policy — this is by design. If the denial is `kill_switch_active`, the agent should cease all operations.
- **Wrong request format**: Check the capability's expected input format. Common mistakes: missing `model` field for `reason`, wrong parameter names. Fix the request body and retry.
- **Service unavailable**: Wait 30 seconds and retry once. If it fails again, try an alternative provider for the same capability. Check `GET /v1/admin/services/health` for uptime data if using an account key.
- **Rate limited**: Wait 60 seconds. Reduce call frequency. If the agent needs burst capacity, batch requests or spread work across time.
- **Budget exceeded**: Stop making calls. Report current spend to the caller. Ask for a higher budget or reduce the scope of work.
- **Invalid API key**: Verify the key format starts with `sk_agt_` for capability/proxy calls. Account keys (`sk_acct_`) cannot make proxy calls. Check with the operator if the key was rotated.
