# codersmu-clients Architecture

This document describes the current runtime shape of `codersmu-clients`, the role of the hosted API, and how fallback works for each client.

## Overview

At a high level:

- `coders.mu` remains the source of truth
- `codersmu.cedpoilly.dev` is the reliability layer in front of it
- CLI, Raycast, and macOS all prefer the hosted API
- each layer has its own fallback behavior

```mermaid
flowchart LR
  Upstream["coders.mu<br/>source of truth"] --> Hosted["codersmu.cedpoilly.dev<br/>hosted API"]

  Hosted --> CLI["CLI"]
  Hosted --> Raycast["Raycast"]
  Hosted --> Mac["macOS menu bar app"]

  Hosted --> Cache["cache + persistence"]
  Hosted --> Health["health checks + monitoring"]
```

## Main Components

### Upstream Truth

- `coders.mu` website and public API are the source of truth
- the hosted API reads from the public API endpoint at `https://coders.mu/api/public/v1`
- the macOS fallback path can also read direct page data from the website

### Hosted API

The hosted API lives at `https://codersmu.cedpoilly.dev` and is implemented in:

- [apps/api/src/server.ts](./apps/api/src/server.ts)
- [apps/api/src/meetups.ts](./apps/api/src/meetups.ts)

It exposes:

- `GET /health`
- `GET /meetups?state=all|upcoming|past`
- `GET /meetups/next`
- `GET /meetups/:slug`

It adds:

- a stable client-facing contract
- short-lived in-memory caching
- persistent disk cache for cold-start fallback
- health metadata and release metadata
- structured logs for operations

### Shared Core

The shared TypeScript client and provider logic lives in:

- [packages/core/src/client.ts](./packages/core/src/client.ts)
- [packages/core/src/providers/frontendmu-api.ts](./packages/core/src/providers/frontendmu-api.ts)

CLI and Raycast use this layer directly.

### Client Surfaces

- CLI uses the shared core and a local cache
- Raycast uses the shared core and a local cache inside the extension support directory
- macOS uses the hosted API first, but keeps its own direct-site fallback path

Relevant files:

- [apps/raycast/src/lib/cmu.ts](./apps/raycast/src/lib/cmu.ts)
- [apps/macos/CodersmuMenuBar/Services/API/CodersMuAPIClient.swift](./apps/macos/CodersmuMenuBar/Services/API/CodersMuAPIClient.swift)
- [apps/macos/CodersmuMenuBar/Services/Source/HTTPMeetupSource.swift](./apps/macos/CodersmuMenuBar/Services/Source/HTTPMeetupSource.swift)

## Hosted API Fallback

The hosted API tries to keep serving useful data even when upstream is unavailable.

```mermaid
flowchart TD
  A["Request hits hosted API"] --> B["Fetch fresh data from coders.mu public API"]
  B --> C{"Success?"}
  C -- yes --> D["Update in-memory cache"]
  D --> E["Write persistent disk cache"]
  E --> F["Return fresh response"]

  C -- no --> G{"In-memory cache available?"}
  G -- yes --> H["Return stale in-memory cache"]

  G -- no --> I{"Fresh disk cache available?"}
  I -- yes --> J["Load persistent cache and return it"]

  I -- no --> K["Return error"]
```

Current implementation details:

- in-memory cache TTL is `60s`
- persistent cache path is controlled by `CODERSMU_API_CACHE_FILE`
- production now mounts persistent storage at `/data/codersmu-api`

## CLI Fallback

The CLI prefers the hosted API, then falls back to the upstream public API, then falls back to its local cache.

```mermaid
flowchart TD
  A["CLI asks shared core for data"] --> B["Try hosted API"]
  B --> C{"Success?"}
  C -- yes --> D["Save local cache"]
  D --> E["Return hosted API data"]

  C -- no --> F["Try coders.mu public API directly"]
  F --> G{"Success?"}
  G -- yes --> H["Save local cache"]
  H --> I["Return upstream data"]

  G -- no --> J{"Local cache available?"}
  J -- yes --> K["Return stale local cache"]
  J -- no --> L["Show error"]
```

## Raycast Fallback

Raycast shares the same basic data path as the CLI because it uses the shared core.

```mermaid
flowchart TD
  A["Raycast command runs"] --> B["Try hosted API via shared core"]
  B --> C{"Success?"}
  C -- yes --> D["Update Raycast local cache"]
  D --> E["Show meetup data"]

  C -- no --> F["Try coders.mu public API directly"]
  F --> G{"Success?"}
  G -- yes --> H["Update Raycast local cache"]
  H --> E

  G -- no --> I{"Local cache available?"}
  I -- yes --> J["Show stale cached data"]
  I -- no --> K["Show failure toast or empty state"]
```

## macOS Fallback

The macOS app does not use the shared TypeScript core at runtime. It prefers the hosted API, then falls back to direct-site fetching and parsing.

```mermaid
flowchart TD
  A["macOS app refreshes"] --> B["Try hosted API"]
  B --> C{"Success?"}
  C -- yes --> D["Convert response to snapshot"]
  D --> E["Persist snapshot locally"]
  E --> F["Update menu bar UI"]

  C -- no --> G["Try direct coders.mu website or page-data path"]
  G --> H{"Success?"}
  H -- yes --> I["Build snapshot from direct-site data"]
  I --> E

  H -- no --> J{"Persisted snapshot available?"}
  J -- yes --> K["Show stale saved snapshot"]
  J -- no --> L["Show no data or error state"]
```

## End-to-End Fallback Summary

This is the shortest accurate mental model for the whole system:

```mermaid
flowchart LR
  Hosted["Hosted API<br/>fresh -> memory cache -> disk cache"] --> Clients["Clients"]

  Clients --> CLI["CLI<br/>hosted -> public API -> local cache"]
  Clients --> Raycast["Raycast<br/>hosted -> public API -> local cache"]
  Clients --> Mac["macOS<br/>hosted -> website/page-data -> saved snapshot"]
```

## Deployment and Operations

Runtime deployment today:

- source code lives in GitHub
- Coolify deploys the hosted API on the VPS
- the hosted API runs in a Docker container
- persistent cache storage is mounted into the container at `/data/codersmu-api`

```mermaid
flowchart TB
  GitHub["GitHub repo<br/>main"] --> Coolify["Coolify"]
  Coolify --> VPS["VPS host"]
  VPS --> Container["codersmu-api container"]
  Container --> Volume["Docker volume<br/>/data/codersmu-api"]
  Container --> Domain["https://codersmu.cedpoilly.dev"]
```

Operational checks:

- local live probe:
  - `npm run check:hosted-api`
- GitHub hosted uptime probe:
  - hourly and manual workflow
- `/health` exposes:
  - `ok`
  - `service`
  - `version`
  - `releaseSha`

CI coverage currently includes:

- shared core checks
- hosted API checks
- Raycast lint and tests
- macOS tests

See:

- [README.md](./README.md)
- [apps/api/README.md](./apps/api/README.md)
- [apps/api/RUNBOOK.md](./apps/api/RUNBOOK.md)
- [.github/workflows/ci.yml](./.github/workflows/ci.yml)
