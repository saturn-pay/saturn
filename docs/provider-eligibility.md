# Provider Eligibility

Saturn is a curated execution registry. Services are reviewed before being made available to agents.

## Who this is for

- API operators
- Infra providers
- Data, compute, or capability services agents can call programmatically

## Requirements

Your API must:

- Use deterministic request/response patterns
- Support idempotent calls
- Return structured JSON
- Have clear unit pricing (per call, per token, or per second)
- Enforce reasonable rate limits
- Not require browser automation or CAPTCHA

## Security requirements

- No dynamic redirects
- No user-supplied URLs without validation
- SSRF-safe
- Auth via headers or static credentials (Saturn holds them)

## Review process

1. Submit via `/v1/registry/submit`
2. Saturn runs test calls in staging
3. Pricing and limits are defined
4. Capability is exposed behind a verb
5. Agents can call it under policy

## What Saturn handles

- Execution
- Authentication
- Pricing and billing
- Budget enforcement
- Lightning settlement

## What providers handle

- Uptime
- Correctness
- Latency guarantees (optional SLA later)

Saturn is not an open marketplace. All services are reviewed.
