---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that Paperclip uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `PAPERCLIP_HOME` | `~/.paperclip` | Base directory for all Paperclip data |
| `PAPERCLIP_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `PAPERCLIP_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `PAPERCLIP_SECRETS_MASTER_KEY_FILE` | `~/.paperclip/.../secrets/master.key` | Path to key file |
| `PAPERCLIP_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_AGENT_ID` | Agent's unique ID |
| `PAPERCLIP_COMPANY_ID` | Company ID |
| `PAPERCLIP_API_URL` | Paperclip API base URL |
| `PAPERCLIP_API_KEY` | Short-lived JWT for API auth |
| `PAPERCLIP_RUN_ID` | Current heartbeat run ID |
| `PAPERCLIP_TASK_ID` | Issue that triggered this wake |
| `PAPERCLIP_WAKE_REASON` | Wake trigger reason |
| `PAPERCLIP_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `PAPERCLIP_APPROVAL_ID` | Resolved approval ID |
| `PAPERCLIP_APPROVAL_STATUS` | Approval decision |
| `PAPERCLIP_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |

## Inbound Guardrail (GROQ) Ops Controls

| Variable | Default | Description |
|----------|---------|-------------|
| `INBOUND_GUARDRAIL_GROQ_API_KEY` | (fallback to `GROQ_API_KEY`) | Dedicated API key for `/api/guardrails/prefilter` classifier calls |
| `INBOUND_GUARDRAIL_GROQ_MODEL` | `llama-3.3-70b-versatile` | GROQ model used by inbound prompt-injection classifier |
| `INBOUND_GUARDRAIL_GROQ_API_BASE` | `https://api.groq.com/openai/v1` | GROQ-compatible API base URL override |
| `INBOUND_GUARDRAIL_TIMEOUT_MS` | `8000` | Request timeout for classifier calls |
| `INBOUND_GUARDRAIL_FAIL_MODE` | `block` | Failure policy when classifier is unavailable: `block` (fail-closed) or `allow` (fail-open) |
| `INBOUND_GUARDRAIL_BYPASS_IDENTIFIERS` | `kirill` | Comma-separated bypass identifiers matched against sender id/email/handle/name |
| `INBOUND_GUARDRAIL_KIRILL_EMAILS` | (empty) | Optional explicit Kirill bypass emails (comma-separated) |

See [Guardrail Ops](/deploy/guardrail-ops) for monitoring and alert thresholds.
