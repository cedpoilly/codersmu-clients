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
