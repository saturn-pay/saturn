# Security & Key Management

## Per-Agent Isolation

Each agent is a security boundary:

- Separate API key
- Separate credit allocation (if using per-agent funding)
- Separate policy (caps, capabilities)
- Separate audit trail

Compromising one agent key does not expose other agents.

## Key Handling

### Generation
- Keys are generated server-side with cryptographic randomness
- Keys are shown once at creation; Saturn does not store plaintext
- Format: `sat_` prefix followed by random string

### Storage
```
✓ Environment variables
✓ Secret managers (AWS Secrets Manager, Vault, etc.)
✓ Encrypted configuration

✗ Source code
✗ Client-side code
✗ Logs
✗ Error messages
```

### Rotation

Rotate keys when:
- Team member leaves
- Key may have been exposed
- Regular rotation policy (recommended: 90 days)

To rotate:
1. Create new agent (or regenerate key via API)
2. Update application configuration
3. Deploy with new key
4. Verify new key works
5. Delete/disable old agent

## Environment Separation

Maintain separate agents for:

| Environment | Purpose |
|-------------|---------|
| Development | Local testing, low caps |
| Staging | Integration testing, moderate caps |
| Production | Real workloads, production caps |

Never use production keys in development. A dev bug with production keys is a production incident.

## Least Privilege via Budgets

Caps are security controls:

```
Research agent: $5/day, reason + search only
Email agent: $1/day, email only
Admin agent: $50/day, all capabilities
```

If a research agent key is compromised, the attacker is limited to $5/day and cannot send emails.

## Logging Guidance

**Do log:**
- Audit IDs
- Agent IDs
- Capability names
- Timestamps
- Error codes

**Do not log:**
- API keys
- Full request/response bodies (may contain PII)
- Credit balances (can indicate business metrics)
