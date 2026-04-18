# Coders.mu Hosted API

Thin HTTP producer for the standardized meetup responses in `/Users/cedricpoilly/code/codersmu-clients/packages/core/src/responses.ts`.

## Endpoints

- `GET /health`
- `GET /meetups?state=all|upcoming|past`
- `GET /meetups/next`
- `GET /meetups/:slug`

## Run locally

```bash
pnpm --filter @codersmu/api build
pnpm --filter @codersmu/api start
```

## Runtime Logging

The hosted API now emits structured JSON logs to stdout/stderr so Coolify can capture:

- request completion with method, pathname, status, and duration
- upstream refresh start/success/failure
- in-memory cache hits
- stale-cache reuse after upstream refresh failures

Use `CODERSMU_API_LOG_LEVEL` to control verbosity:

- `info` (default outside tests)
- `debug`
- `warn`
- `error`
- `silent`

The main event names to watch during incidents are:

- `request_completed`
- `request_failed`
- `provider_refresh_started`
- `provider_refresh_succeeded`
- `provider_refresh_failed`
- `provider_stale_cache_reused`

For deploy, verify, rollback, and first-triage steps, see [RUNBOOK.md](/Users/cedricpoilly/code/codersmu-clients/apps/api/RUNBOOK.md).
