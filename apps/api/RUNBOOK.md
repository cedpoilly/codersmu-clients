# Hosted API Runbook

Operational notes for the deployed Coders.mu hosted API.

## Service

- Public base URL: `https://codersmu.lepopquiz.app`
- Health endpoint: `https://codersmu.lepopquiz.app/health`
- Coolify app: `codersmu-api`
- Default upstream API: `https://coders.mu/api/public/v1`
- Optional release env: `CODERSMU_RELEASE_SHA`

## Verify

Quick public check:

```bash
curl -fsSL https://codersmu.lepopquiz.app/health
```

Full live smoke test from this repository:

```bash
npm run check:hosted-api
```

The same probe now runs in GitHub Actions via the `Hosted API` workflow:

- hourly on a schedule
- on manual `workflow_dispatch`

Treat that workflow as an uptime probe for the live deployment, not proof that the latest Git commit is already running in Coolify.

Expected health response:

```json
{"ok":true,"service":"codersmu-api","version":"0.0.0-prototype.1"}
```

## Deploy

1. Push `main`.
2. Trigger a fresh Coolify deployment for `codersmu-api`.
3. Wait for the deployment to finish.
4. Run the verify steps above.
5. If you want a GitHub-side confirmation too, run the `Hosted API` workflow manually after deployment finishes.

If `CODERSMU_RELEASE_SHA` is set in the runtime environment, `/health` and the `x-codersmu-release-sha` header expose the live deployed revision directly.

If the health check passes but the UI still shows stale state in Coolify, trust the public health check over a stale page badge.

## Rollback

If a fresh deployment is unhealthy:

1. Redeploy the previous known-good commit in Coolify.
2. Re-run:

```bash
npm run check:hosted-api
```

3. Confirm `https://codersmu.lepopquiz.app/health` returns `200`.

Known recent good commits:

- `ce5946c` — structured hosted API logging
- `530e981` — stronger hosted API smoke test
- `a319fee` — `HEAD /health` support

## Runtime Logs

The service emits structured JSON logs. Key events:

- `server_started`
- `request_completed`
- `request_failed`
- `provider_refresh_started`
- `provider_refresh_succeeded`
- `provider_refresh_failed`
- `provider_stale_cache_reused`

Useful interpretations:

- repeated `request_failed` on `/meetups*`: request path is breaking before a response is produced
- repeated `provider_refresh_failed` followed by `provider_stale_cache_reused`: upstream is unhealthy, but the API is still serving stale data
- repeated `provider_refresh_failed` without `provider_stale_cache_reused`: there is no warm cache, so the API will likely return `500`

## Environment

Primary runtime variables:

- `PORT`
- `CODERSMU_UPSTREAM_API_BASE_URL`
- `CODERSMU_API_LOG_LEVEL`
- `CODERSMU_RELEASE_SHA`

Suggested production values:

- `PORT=8787`
- `CODERSMU_UPSTREAM_API_BASE_URL=https://coders.mu/api/public/v1`
- `CODERSMU_API_LOG_LEVEL=info`
- `CODERSMU_RELEASE_SHA=<git-sha>`

## First Triage

If the service looks broken:

1. Check `https://codersmu.lepopquiz.app/health`.
2. Run `npm run check:hosted-api`.
3. Check the latest `Hosted API` GitHub Actions run if you need an externalized probe result.
4. Inspect the latest Coolify runtime logs for:
   - `request_failed`
   - `provider_refresh_failed`
   - `provider_stale_cache_reused`
5. If upstream is failing but stale cache reuse is happening, this is degraded but not down.
6. If health is down and logs are empty, suspect container/process startup failure.
