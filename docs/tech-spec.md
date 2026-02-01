# Saturn Technical Specification: Capability Routing Architecture

**Version:** 1.0
**Status:** Draft
**Date:** 2026-02-01

---

## Table of Contents

1. [Overview](#1-overview)
2. [Capability Routing Architecture](#2-capability-routing-architecture)
3. [API Endpoints](#3-api-endpoints)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Policy Evaluation](#5-policy-evaluation)
6. [Proxy Execution Lifecycle](#6-proxy-execution-lifecycle)
7. [Error Handling](#7-error-handling)
8. [Rate Limiting](#8-rate-limiting)
9. [SDK Interface](#9-sdk-interface)
10. [Future: Request/Response Normalization (v2)](#10-future-requestresponse-normalization-v2)

---

## 1. Overview

Saturn is an agent-native payments and execution layer. It wraps upstream APIs behind **capability verbs** and charges agents in Bitcoin satoshis via Lightning Network. Rather than coupling agents to specific providers, Saturn introduces a routing layer that maps high-level capabilities (e.g., `reason`, `search`, `read`) to ranked provider pools. The agent expresses intent through a verb; Saturn resolves the provider, executes the upstream call, meters usage, and settles payment atomically.

This specification defines the capability routing architecture, the API surface it exposes, the database changes it requires, and the policy and execution lifecycle it integrates with.

---

## 2. Capability Routing Architecture

### 2.1 Capability Registry

The capability registry is the central data structure that maps **10 capability verbs** to ordered provider pools. It is defined in configuration and loaded at startup.

Each capability entry contains:

| Field             | Type                        | Description                                              |
|-------------------|-----------------------------|----------------------------------------------------------|
| `capability`      | `string`                    | The verb identifier (e.g., `reason`, `search`).          |
| `description`     | `string`                    | Human-readable description of what the capability does.  |
| `providers`       | `Provider[]`                | Ordered array of providers that can fulfill this verb.   |
| `defaultProvider` | `string`                    | Slug of the provider used when no preference is given.   |

Each provider within a capability entry:

| Field      | Type      | Description                                                      |
|------------|-----------|------------------------------------------------------------------|
| `slug`     | `string`  | Unique provider identifier (e.g., `openai`, `serper`).           |
| `priority` | `number`  | Lower number means higher priority. `1` is highest.              |
| `active`   | `boolean` | Whether this provider is currently available for routing.        |

### 2.2 Provider Mappings

```
Capability     Providers [slug (priority)]
─────────────  ──────────────────────────────────────
reason         openai (1), anthropic (2)
search         serper (1), brave-search (2)
read           jina (1), firecrawl (2)
scrape         firecrawl (1), scraperapi (2)
execute        e2b (1)
email          resend (1)
sms            twilio (1)
imagine        replicate (1)
speak          elevenlabs (1)
transcribe     deepgram (1)
```

### 2.3 Resolution Algorithm

When an agent calls a capability verb, the router resolves a concrete provider using the following algorithm:

```
1. Look up the capability in the registry.
2. Filter the providers array to those where `active === true`.
3. Filter to those that have a registered adapter in the adapter registry.
4. Sort remaining providers by `priority` ascending (lowest number = highest priority).
5. Select the first provider in the sorted list.
6. If no provider survives filtering, return 404 NOT_FOUND.
```

The resolution is deterministic: given the same registry state, the same provider is always selected. This makes routing predictable and auditable.

### 2.4 Adapter Registry

Each provider must have a corresponding adapter that implements the `ServiceAdapter` interface. The adapter is responsible for:

- Constructing the upstream HTTP request (URL, headers, body).
- Parsing the upstream response.
- Extracting usage metrics for cost computation.

If a provider is listed in the capability registry but has no registered adapter, it is skipped during resolution. This allows providers to be pre-configured in the registry before their adapter code is deployed.

---

## 3. API Endpoints

### 3.1 POST /v1/capabilities/:capability (NEW)

The primary capability-routed endpoint. Agents call a verb; Saturn resolves the provider and executes.

**Authentication:** Bearer token (`sk_agt_...`) in the `Authorization` header.

**Path Parameters:**

| Parameter    | Type     | Description                                  |
|--------------|----------|----------------------------------------------|
| `capability` | `string` | One of the 10 capability verbs.              |

**Query Parameters:**

| Parameter  | Type     | Required | Description                                         |
|------------|----------|----------|-----------------------------------------------------|
| `provider` | `string` | No       | Override the default provider (e.g., `anthropic`).   |

**Request Body:** Provider-specific format (v1 passthrough). The body is forwarded to the resolved provider's adapter without transformation.

**Response Headers:**

| Header                     | Description                                              |
|----------------------------|----------------------------------------------------------|
| `X-Saturn-Audit-Id`        | UUID of the audit log entry for this call.               |
| `X-Saturn-Quoted-Sats`     | Estimated cost in satoshis (from the quote step).        |
| `X-Saturn-Charged-Sats`    | Actual cost in satoshis after execution.                 |
| `X-Saturn-Balance-After`   | Agent's remaining balance in satoshis after settlement.  |
| `X-Saturn-Capability`      | The capability verb that was resolved.                   |
| `X-Saturn-Provider`        | The provider slug that fulfilled the request.            |

**Response Body:** Provider-specific format (v1 passthrough). The upstream response is returned as-is.

**Example:**

```http
POST /v1/capabilities/reason HTTP/1.1
Authorization: Bearer sk_agt_abc123
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "Explain quantum computing in one sentence." }
  ]
}
```

```http
HTTP/1.1 200 OK
X-Saturn-Audit-Id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Saturn-Quoted-Sats: 150
X-Saturn-Charged-Sats: 142
X-Saturn-Balance-After: 9858
X-Saturn-Capability: reason
X-Saturn-Provider: openai
Content-Type: application/json

{
  "id": "chatcmpl-...",
  "choices": [...]
}
```

### 3.2 POST /v1/proxy/:serviceSlug (LEGACY)

The original provider-direct endpoint. Retained for backward compatibility. Agents that already reference providers by slug continue to work without modification.

**Authentication:** Bearer token (`sk_agt_...`).

**Path Parameters:**

| Parameter     | Type     | Description                         |
|---------------|----------|-------------------------------------|
| `serviceSlug` | `string` | Provider slug (e.g., `openai`).     |

**Behavior:** Identical to the capability endpoint, but skips capability resolution. The adapter is looked up directly by slug. The `capability` field in the audit log is populated by reverse-mapping the slug to its capability, if one exists.

### 3.3 GET /v1/capabilities

Returns the full capability catalog. Intended for agent discovery: an agent can inspect available capabilities, their descriptions, and pricing before making calls.

**Authentication:** None required (public endpoint).

**Response Body:**

```json
{
  "capabilities": [
    {
      "capability": "reason",
      "description": "Large language model inference (chat completions, text generation).",
      "defaultProvider": "openai",
      "providers": [
        { "slug": "openai", "priority": 1, "active": true },
        { "slug": "anthropic", "priority": 2, "active": true }
      ],
      "pricing": {
        "provider": "openai",
        "unit": "sats",
        "estimatedCostPerCall": 150,
        "note": "Pricing shown for default provider. Actual cost depends on usage."
      }
    }
  ]
}
```

### 3.4 GET /v1/capabilities/:capability

Returns a single capability with detailed pricing for all providers.

**Authentication:** None required (public endpoint).

**Path Parameters:**

| Parameter    | Type     | Description                     |
|--------------|----------|---------------------------------|
| `capability` | `string` | One of the 10 capability verbs. |

**Response Body:**

```json
{
  "capability": "search",
  "description": "Web search and retrieval.",
  "defaultProvider": "serper",
  "providers": [
    {
      "slug": "serper",
      "priority": 1,
      "active": true,
      "pricing": {
        "unit": "sats",
        "estimatedCostPerCall": 5
      }
    },
    {
      "slug": "brave-search",
      "priority": 2,
      "active": true,
      "pricing": {
        "unit": "sats",
        "estimatedCostPerCall": 6
      }
    }
  ]
}
```

---

## 4. Database Schema Changes

### 4.1 audit_logs Table

A new nullable column is added to record which capability verb was used for each call.

```sql
ALTER TABLE audit_logs ADD COLUMN capability TEXT;
```

| Column       | Type   | Nullable | Description                                            |
|--------------|--------|----------|--------------------------------------------------------|
| `capability` | `TEXT` | Yes      | The capability verb (e.g., `reason`). NULL for legacy proxy calls that do not map to a capability. |

This column enables querying and aggregation by capability across all providers. For example: "How many `search` calls did agent X make this week, regardless of whether they hit Serper or Brave Search?"

### 4.2 policies Table

Two new array columns are added to support capability-level access control.

```sql
ALTER TABLE policies ADD COLUMN allowed_capabilities TEXT[];
ALTER TABLE policies ADD COLUMN denied_capabilities TEXT[];
```

| Column                  | Type     | Nullable | Description                                                     |
|-------------------------|----------|----------|-----------------------------------------------------------------|
| `allowed_capabilities`  | `TEXT[]` | Yes      | If non-empty, only these capabilities are permitted.            |
| `denied_capabilities`   | `TEXT[]` | Yes      | These capabilities are explicitly blocked.                      |

Semantics follow the same pattern as the existing `allowed_services` / `denied_services` columns:

- If `denied_capabilities` contains the requested capability, the call is rejected.
- If `allowed_capabilities` is non-empty and does not contain the requested capability, the call is rejected.
- If both are empty/null, no capability-level restriction is applied.

---

## 5. Policy Evaluation

Policy evaluation is a 9-step gate that every proxied call must pass before execution. Steps are evaluated in order; the first failure short-circuits with a `403 POLICY_DENIED` response.

| Step | Check                    | Failure Reason             | Description                                                                 |
|------|--------------------------|----------------------------|-----------------------------------------------------------------------------|
| 1    | Agent active check       | `agent_inactive`           | The agent's `is_active` flag must be `true`.                                |
| 2    | Kill switch              | `kill_switch`              | The global kill switch must not be engaged.                                 |
| 3    | Denied services          | `service_denied`           | The target service slug must not appear in `denied_services`.               |
| 4    | Allowed services         | `service_not_allowed`      | If `allowed_services` is non-empty, the target slug must be listed.         |
| 5    | Denied capabilities      | `capability_denied`        | The resolved capability must not appear in `denied_capabilities`.           |
| 6    | Allowed capabilities     | `capability_not_allowed`   | If `allowed_capabilities` is non-empty, the capability must be listed.      |
| 7    | Per-call limit           | `per_call_limit_exceeded`  | The quoted cost must not exceed the per-call satoshi limit.                 |
| 8    | Daily spend limit        | `daily_limit_exceeded`     | The agent's spend today plus the quoted cost must not exceed the daily cap. |
| 9    | All passed               | --                         | The call is permitted.                                                      |

Steps 5 and 6 are new. They are skipped (pass automatically) when the call arrives via the legacy `/v1/proxy/:serviceSlug` endpoint and no capability mapping exists for that slug.

---

## 6. Proxy Execution Lifecycle

Every call through Saturn -- whether via the capability endpoint or the legacy proxy endpoint -- follows a 7-step lifecycle. The lifecycle is implemented in `executeProxyCall()` and is designed to guarantee atomicity: funds are never lost, and every call is audited regardless of outcome.

### Step 1: Resolve Adapter

- **Capability route:** Run the resolution algorithm (Section 2.3) to determine the provider slug, then look up the adapter.
- **Legacy route:** Look up the adapter directly by the `:serviceSlug` path parameter.
- **Failure:** 404 NOT_FOUND if no adapter is found.

### Step 2: Quote

Estimate the cost of the call in satoshis. The adapter's `quote()` method inspects the request body (e.g., model name, estimated token count) and returns an estimated cost.

The quote is advisory for the hold amount. Actual cost is computed after execution based on real usage.

### Step 3: Policy Check

Run the 9-step policy evaluation (Section 5). The quoted cost is used for per-call and daily limit checks.

- **Failure:** 403 POLICY_DENIED with the specific reason.

### Step 4: Hold Funds

Atomically deduct the quoted amount from the agent's balance using a SQL transaction:

```sql
UPDATE agents
SET balance_sats = balance_sats - :quoted_sats
WHERE id = :agent_id
  AND balance_sats >= :quoted_sats;
```

If the update affects zero rows, the agent has insufficient balance.

- **Failure:** 402 INSUFFICIENT_BALANCE.

### Step 5: Execute Upstream Call

The adapter constructs and sends the HTTP request to the upstream provider. Timeouts and retries are handled at the adapter level.

- **Failure:** Proceed to Step 7 (failure path).

### Step 6: Success Path

```
6a. Finalize  — Compute actual cost from the upstream response (e.g., actual tokens used).
6b. Settle    — If actual cost < quoted cost, refund the difference atomically.
                If actual cost > quoted cost, deduct the additional amount (with a
                configurable overage tolerance).
6c. Audit     — Write the audit log entry with: agent_id, service_slug, capability,
                quoted_sats, charged_sats, balance_after, request metadata,
                response status, and timestamp.
```

### Step 7: Failure Path

```
7a. Release hold  — Refund the full held amount back to the agent's balance.
7b. Audit         — Write the audit log entry with error details, status code,
                    and upstream error message (if available).
7c. Throw         — Return the appropriate error response to the caller (502
                    UPSTREAM_ERROR for provider failures).
```

### Lifecycle Diagram

```
  Request
    |
    v
 [1] Resolve Adapter ──(not found)──> 404
    |
    v
 [2] Quote
    |
    v
 [3] Policy Check ──(denied)──> 403
    |
    v
 [4] Hold Funds ──(insufficient)──> 402
    |
    v
 [5] Execute Upstream
    |           \
    v            v
 [6] Success   [7] Failure
  6a. Finalize   7a. Release hold
  6b. Settle     7b. Audit
  6c. Audit      7c. Throw
    |
    v
 Response
```

---

## 7. Error Handling

All error responses follow a consistent JSON envelope:

```json
{
  "error": {
    "code": "POLICY_DENIED",
    "message": "Capability 'imagine' is not in the allowed capabilities list.",
    "reason": "capability_not_allowed",
    "statusCode": 403
  }
}
```

### Error Codes

| HTTP Status | Error Code             | When                                                              |
|-------------|------------------------|-------------------------------------------------------------------|
| 400         | `VALIDATION_ERROR`     | Malformed request body, missing required fields, invalid verb.    |
| 401         | `AUTH_ERROR`           | Missing, invalid, or expired bearer token.                        |
| 402         | `INSUFFICIENT_BALANCE` | Agent's satoshi balance is less than the quoted cost.             |
| 403         | `POLICY_DENIED`        | One of the 9 policy steps failed. The `reason` field specifies which: `agent_inactive`, `kill_switch`, `service_denied`, `service_not_allowed`, `capability_denied`, `capability_not_allowed`, `per_call_limit_exceeded`, `daily_limit_exceeded`. |
| 404         | `NOT_FOUND`            | Unknown capability verb or no active provider/adapter found.      |
| 429         | `RATE_LIMIT`           | Request rate exceeded the allowed threshold.                      |
| 502         | `UPSTREAM_ERROR`       | The upstream provider returned an error or timed out.             |

---

## 8. Rate Limiting

Rate limits are applied per agent token using a sliding-window counter.

| Endpoint                            | Limit           | Window  |
|-------------------------------------|-----------------|---------|
| `POST /v1/capabilities/:capability` | 60 req/min      | 1 min   |
| `POST /v1/proxy/:serviceSlug`       | 60 req/min      | 1 min   |
| `GET /v1/capabilities`              | 100 req/min     | 1 min   |
| `GET /v1/capabilities/:capability`  | 100 req/min     | 1 min   |
| Global default (all other routes)   | 100 req/min     | 1 min   |

When a rate limit is exceeded, the response includes:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 12
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706832000
```

---

## 9. SDK Interface

The Saturn TypeScript SDK exposes capability verbs as first-class methods alongside the existing provider-direct interface.

### 9.1 Capability Methods (NEW)

Each of the 10 capability verbs is available as a method on `saturn.proxy`:

```typescript
// Reasoning / LLM inference
const response = await saturn.proxy.reason({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Explain quantum computing." }]
});

// Web search
const results = await saturn.proxy.search({
  query: "latest AI research papers"
});

// Page reading (clean text extraction)
const page = await saturn.proxy.read({
  url: "https://example.com/article"
});

// Web scraping (structured data extraction)
const data = await saturn.proxy.scrape({
  url: "https://example.com/products",
  selector: ".product-card"
});

// Code execution
const output = await saturn.proxy.execute({
  language: "python",
  code: "print(2 + 2)"
});

// Email
await saturn.proxy.email({
  to: "user@example.com",
  subject: "Hello",
  body: "World"
});

// SMS
await saturn.proxy.sms({
  to: "+1234567890",
  body: "Hello from Saturn"
});

// Image generation
const image = await saturn.proxy.imagine({
  prompt: "A cat on the moon, oil painting"
});

// Text-to-speech
const audio = await saturn.proxy.speak({
  text: "Hello, world.",
  voice: "alloy"
});

// Speech-to-text
const transcript = await saturn.proxy.transcribe({
  audio: audioBuffer
});
```

Each method:
- Sends `POST /v1/capabilities/:capability` under the hood.
- Accepts an optional second argument `{ provider?: string }` to override the default.
- Returns the upstream response body plus Saturn metadata (audit ID, charged sats, balance).

### 9.2 Legacy Methods (Backward Compatible)

```typescript
// Provider-direct call (generic)
const response = await saturn.proxy.call("openai", {
  model: "gpt-4o",
  messages: [...]
});

// Provider-direct call (named shorthand)
const response = await saturn.proxy.openai({
  model: "gpt-4o",
  messages: [...]
});
```

These methods continue to call `POST /v1/proxy/:serviceSlug`.

### 9.3 Capability Catalog

```typescript
// List all capabilities
const catalog = await saturn.capabilities.list();
// Returns: { capabilities: [{ capability, description, defaultProvider, providers, pricing }] }

// Get single capability detail
const search = await saturn.capabilities.get("search");
// Returns: { capability, description, defaultProvider, providers: [{ slug, priority, active, pricing }] }
```

---

## 10. Future: Request/Response Normalization (v2)

### 10.1 Current State (v1): Passthrough

In v1, the request body sent to a capability endpoint is provider-specific. If an agent calls `POST /v1/capabilities/reason` with an OpenAI-formatted body, and the provider resolves to OpenAI, it works. If the provider resolves to Anthropic (e.g., due to failover), the agent's OpenAI-formatted body will fail.

This is acceptable for v1 because:
- Agents typically know which provider format they are sending.
- The `?provider=` query parameter allows explicit override.
- The default provider is predictable and stable.

### 10.2 Future State (v2): Normalized Types

In v2, each capability will define a canonical request and response type. Saturn will transform these normalized formats into provider-specific formats internally.

```typescript
// v2 normalized types (future)
interface ReasonRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;          // Optional: Saturn picks appropriate model per provider
  maxTokens?: number;
  temperature?: number;
}

interface SearchRequest {
  query: string;
  numResults?: number;
  dateRange?: { from: string; to: string };
}

interface ReadRequest {
  url: string;
  format?: "text" | "markdown" | "html";
}

interface ScrapeRequest {
  url: string;
  selector?: string;
  format?: "json" | "html";
}

interface ExecuteRequest {
  language: string;
  code: string;
  timeout?: number;
}

interface EmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  from?: string;
}

interface SmsRequest {
  to: string;
  body: string;
  from?: string;
}

interface ImagineRequest {
  prompt: string;
  width?: number;
  height?: number;
  format?: "png" | "jpeg" | "webp";
}

interface SpeakRequest {
  text: string;
  voice?: string;
  format?: "mp3" | "wav" | "opus";
}

interface TranscribeRequest {
  audio: Buffer | string;   // Buffer or base64
  language?: string;
}
```

With normalization, provider failover becomes transparent. An agent sends a `ReasonRequest`; Saturn transforms it to the OpenAI format, Anthropic format, or any future provider format as needed. The agent never changes its code.

### 10.3 Migration Path

- v1 endpoints remain stable and supported indefinitely.
- v2 endpoints will be introduced under `/v2/capabilities/:capability`.
- SDK methods will default to v2 when available, with a `{ apiVersion: "v1" }` escape hatch.
- A `Content-Type: application/vnd.saturn.v2+json` header may also be used to signal v2 format on the v1 URL, avoiding a path-level version bump.

---

## Appendix A: Capability Descriptions

| Capability   | Description                                                        |
|--------------|--------------------------------------------------------------------|
| `reason`     | Large language model inference: chat completions, text generation.  |
| `search`     | Web search and retrieval of search engine results.                 |
| `read`       | Clean text extraction from a URL (reader mode).                    |
| `scrape`     | Structured data extraction from web pages.                         |
| `execute`    | Sandboxed code execution in an ephemeral runtime.                  |
| `email`      | Send transactional email.                                          |
| `sms`        | Send SMS messages.                                                 |
| `imagine`    | Image generation from text prompts.                                |
| `speak`      | Text-to-speech audio synthesis.                                    |
| `transcribe` | Speech-to-text transcription.                                      |

## Appendix B: Configuration Example

```typescript
export const CAPABILITY_REGISTRY: CapabilityRegistry = {
  reason: {
    description: "Large language model inference.",
    providers: [
      { slug: "openai", priority: 1, active: true },
      { slug: "anthropic", priority: 2, active: true }
    ],
    defaultProvider: "openai"
  },
  search: {
    description: "Web search and retrieval.",
    providers: [
      { slug: "serper", priority: 1, active: true },
      { slug: "brave-search", priority: 2, active: true }
    ],
    defaultProvider: "serper"
  },
  read: {
    description: "Clean text extraction from a URL.",
    providers: [
      { slug: "jina", priority: 1, active: true },
      { slug: "firecrawl", priority: 2, active: true }
    ],
    defaultProvider: "jina"
  },
  scrape: {
    description: "Structured data extraction from web pages.",
    providers: [
      { slug: "firecrawl", priority: 1, active: true },
      { slug: "scraperapi", priority: 2, active: true }
    ],
    defaultProvider: "firecrawl"
  },
  execute: {
    description: "Sandboxed code execution.",
    providers: [
      { slug: "e2b", priority: 1, active: true }
    ],
    defaultProvider: "e2b"
  },
  email: {
    description: "Send transactional email.",
    providers: [
      { slug: "resend", priority: 1, active: true }
    ],
    defaultProvider: "resend"
  },
  sms: {
    description: "Send SMS messages.",
    providers: [
      { slug: "twilio", priority: 1, active: true }
    ],
    defaultProvider: "twilio"
  },
  imagine: {
    description: "Image generation from text prompts.",
    providers: [
      { slug: "replicate", priority: 1, active: true }
    ],
    defaultProvider: "replicate"
  },
  speak: {
    description: "Text-to-speech audio synthesis.",
    providers: [
      { slug: "elevenlabs", priority: 1, active: true }
    ],
    defaultProvider: "elevenlabs"
  },
  transcribe: {
    description: "Speech-to-text transcription.",
    providers: [
      { slug: "deepgram", priority: 1, active: true }
    ],
    defaultProvider: "deepgram"
  }
};
```
