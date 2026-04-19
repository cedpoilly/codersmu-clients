# Hosted API Runbook

Operational notes for the deployed Coders.mu hosted API.

## Service

- Public base URL: `https://codersmu.cedpoilly.dev`
- Health endpoint: `https://codersmu.cedpoilly.dev/health`
- Coolify app: `codersmu-api`
- Default upstream API: `https://coders.mu/api/public/v1`
- Optional release env: `CODERSMU_RELEASE_SHA`
- Optional durable cache env: `CODERSMU_API_CACHE_FILE`

### TLS resolver note

`codersmu.cedpoilly.dev` is a single-host deployment and should use the Coolify / Traefik HTTP ACME resolver, not the wildcard DNS-challenge resolver.

For this app route, the effective Traefik label needs to resolve to:

```text
traefik.http.routers.https-0-kog44s4c4cs0csog8cwgc400.tls.certresolver=letsencrypt-http
```

Why this matters:

- the server-wide `letsencrypt` resolver was configured for a Namecheap DNS challenge
- `cedpoilly.dev` is managed in DNSimple
- using the wrong resolver caused repeated ACME failures for `codersmu.cedpoilly.dev`

If the custom domain ever starts serving an invalid fallback certificate again, check the generated app route first before changing DNS.

## Verify

Quick public check:

```bash
curl -fsSL https://codersmu.cedpoilly.dev/health
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

### Build artifacts

`apps/api` is built by `tsdown`. The bundle keeps `@codersmu/core` as an external `import`, so the runtime environment must resolve it.

**Do not** ship `apps/api/dist/` plus `apps/api/node_modules/` from a plain workspace install. `pnpm install` at the repo root creates `apps/api/node_modules/@codersmu/core` as a symlink into the monorepo (`../../../../packages/core`). If that target is not present on the deploy host, Node fails with `ERR_MODULE_NOT_FOUND` at startup.

Produce a self-contained deploy tree with:

```bash
pnpm -w deploy:api <target-dir>
```

The `-w` flag runs the script from the workspace root, so this command works from any directory inside the repo (including `apps/api/`). The script is defined only in the root `package.json`; running `pnpm deploy:api` from `apps/api/` without `-w` will fail with "script not found."

`pnpm -w deploy:api` wraps the required steps: it builds `@codersmu/core` and `@codersmu/api` into their respective `dist/` directories, then runs `pnpm deploy --filter @codersmu/api --prod --legacy <target-dir>` to copy everything needed into `<target-dir>`. Both `apps/api/dist/` and `packages/core/dist/` are gitignored, so **running `pnpm deploy` without a fresh build will ship stale or empty `dist/` content.** Always use `pnpm -w deploy:api` (or run the builds explicitly first) — never `pnpm deploy --filter @codersmu/api` on its own.

The resulting `<target-dir>` contains `dist/server.mjs`, a flat `package.json`, and a fully resolved `node_modules/` (including `@codersmu/core` with its own `dist/` + `package.json`). Run the server as:

```bash
node dist/server.mjs
```

The `--legacy` flag is required because the workspace does not opt into `inject-workspace-packages`. If you later set `inject-workspace-packages=true` in `.npmrc`, drop `--legacy`.

The package version is inlined into `dist/server.mjs` at build time, so the top-level `apps/api/package.json` is not required for the version to appear in `/health`.

If the health check passes but the UI still shows stale state in Coolify, trust the public health check over a stale page badge.

## Rollback

If a fresh deployment is unhealthy:

1. Redeploy the previous known-good commit in Coolify.
2. Re-run:

```bash
npm run check:hosted-api
```

3. Confirm `https://codersmu.cedpoilly.dev/health` returns `200`.

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
- `provider_disk_cache_loaded`
- `provider_disk_cache_reused`
- `provider_disk_cache_write_failed`

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
- `CODERSMU_API_CACHE_FILE`

Suggested production values:

- `PORT=8787`
- `CODERSMU_UPSTREAM_API_BASE_URL=https://coders.mu/api/public/v1`
- `CODERSMU_API_LOG_LEVEL=info`
- `CODERSMU_RELEASE_SHA=<git-sha>`
- `CODERSMU_API_CACHE_FILE=/data/codersmu-api/meetups-cache.json`

## Threat Model

Design assumptions an operator should know about:

- **Unauthenticated public read-only API.** There is no auth layer. Anyone on the public internet can call `/meetups`, `/meetups/next`, `/meetups/<slug>`. The service returns only data that is already public on `https://coders.mu`.
- **No application-level rate limiting.** Rate limiting is expected to live at the edge (Coolify / reverse proxy). The 60-second in-memory cache bounds upstream impact: a single warm API instance makes at most one upstream refresh per minute regardless of inbound traffic.
- **Error responses are redacted.** On a 500, the client sees only `{"error":"Internal server error."}`. The underlying cause (stack, upstream host, TLS details) stays in structured logs. Do not reintroduce `error.message` into 5xx response bodies.
- **Slug input is bounded.** `/meetups/<slug>` rejects anything outside `^[a-zA-Z0-9-]{1,128}$` with a `400`, without calling the provider.
- **`x-codersmu-service`, `x-codersmu-version`, and `x-codersmu-release-sha` are advertised on every response.** This is an intentional operations trade-off (ops visibility > fingerprint hiding). If you ever front the service with a CDN that doesn't scrub, that's acceptable — the code is public.
- **Upstream detail fetches fail soft.** If `fetchMeetupDetail` fails for a specific meetup, the provider falls back to the list-only shape and logs `provider_detail_fetch_failed`. Recurring entries for the same `meetupId` mean persistent upstream degradation on that record, not a hosted-API bug.

## First Triage

If the service looks broken:

1. Check `https://codersmu.cedpoilly.dev/health`.
2. Run `npm run check:hosted-api`.
3. Check the latest `Hosted API` GitHub Actions run if you need an externalized probe result.
4. Inspect the latest Coolify runtime logs for:
   - `request_failed`
   - `provider_refresh_failed`
   - `provider_stale_cache_reused`
5. If upstream is failing but stale cache reuse is happening, this is degraded but not down.
6. If health is down and logs are empty, suspect container/process startup failure.
