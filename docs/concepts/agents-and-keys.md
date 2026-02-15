# Agents & Keys

## Definition

An **agent** is an isolated identity within Saturn. Each agent has:
- A unique ID
- An API key
- Its own credit balance
- Its own policy (caps, allowed capabilities)
- Its own audit trail

An agent is not a user account. It's a runtime identity for a specific workload.

## Why It Exists

Agents provide isolation boundaries. When Agent A exhausts its budget, Agent B continues operating. When Agent A's key is compromised, you revoke one key—not your entire system.

Without per-agent isolation:
- One runaway loop drains your entire balance
- One compromised key exposes all capabilities
- Cost attribution is impossible

## Enforcement Behavior

- Every API call requires a valid agent key
- Invalid or revoked keys return `401 Unauthorized`
- Agent keys are scoped to their policy—they cannot exceed their caps regardless of account balance
- Kill switch on an agent immediately blocks all calls for that agent

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Using one agent for all workloads | No isolation, no attribution |
| Sharing keys across environments | Production incidents from dev mistakes |
| Not rotating keys after team changes | Security exposure |
| Creating agents without caps | Unbounded spend risk |

## Example

```typescript
// Create a dedicated agent for a specific workload
const { saturn, apiKey } = await Saturn.signup({
  name: 'research-agent-prod'
});

// Store apiKey securely — this is the agent's identity
// Each agent operates independently with its own budget
```
