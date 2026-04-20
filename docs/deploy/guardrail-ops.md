---
title: Guardrail Ops
summary: Secrets, monitoring, and alerting for inbound guardrail prefilter
---

Use this runbook to operate `/api/guardrails/prefilter` safely in production.

## Secrets and Deployment

1. Set `INBOUND_GUARDRAIL_GROQ_API_KEY` via encrypted secret reference.
2. Set `INBOUND_GUARDRAIL_FAIL_MODE=block` for fail-closed behavior.
3. Configure `INBOUND_GUARDRAIL_TIMEOUT_MS` between `5000` and `10000`.
4. Configure bypass identities with:
   - `INBOUND_GUARDRAIL_BYPASS_IDENTIFIERS`
   - `INBOUND_GUARDRAIL_KIRILL_EMAILS`
5. Keep `PAPERCLIP_SECRETS_STRICT_MODE=true` in production.

## Monitoring Signals

The route emits structured logs for each decision with:

- `event=guardrail_prefilter_evaluated`
- `decision` (`allow`, `block`, `bypass`)
- `source` (`classifier`, `bypass`, `failure_policy`)
- `reasonCode` (normalized reason)
- `channel`, `flags`, model metadata

`source=failure_policy` is logged at `warn` and should be treated as degraded mode.

## Alert Rules

Set alerts on 5-minute windows (unless your platform requires a different interval):

1. `guardrail_failure_policy_rate > 1%` for 10 minutes
   - Query: count of `event=guardrail_prefilter_evaluated AND source=failure_policy` / total guardrail events
2. `guardrail_block_rate > 40%` for 10 minutes
   - Helps detect prompt-injection waves or model misclassification regressions
3. `guardrail_fail_open_events > 0` for 5 minutes in production
   - Query: `source=failure_policy AND decision=allow`
4. `guardrail_missing_key_events > 0` for 1 minute
   - Query: `reasonCode=missing_groq_api_key`

## Triage Guidance

- High block spike + low failure policy rate: likely inbound abuse campaign.
- Failure policy spike + `missing_groq_api_key`: secret missing/expired/rotation issue.
- Failure policy spike + `groq_http_429` or timeout reason codes: provider saturation, raise timeout or add retry upstream.
- Unexpected fail-open events: misconfigured `INBOUND_GUARDRAIL_FAIL_MODE`.
