# codersmu-clients

Clients and infrastructure for bringing Coders.mu meetup data into developer tools.

This repository contains the shared meetup-fetching core, a hosted API, a CLI, a macOS menu bar app, and a Raycast extension. The project is still exploratory, but it is actively used and contributions are welcome, especially around reliability, polish, and developer experience.

## What This Repo Contains

- `src/`: installable CLI package exposed as `codersmu` and `cmu`
- `packages/core`: shared meetup fetching, cache, calendar, and provider logic
- `apps/api`: hosted API used by the shipped clients
- `apps/macos`: native macOS menu bar app
- `apps/raycast`: Raycast extension

## Current Status

- prototype codebase, not a stable public platform yet
- GitHub-first distribution, no npm release yet
- the CLI, macOS app, and Raycast extension prefer the hosted API at `https://codersmu.cedpoilly.dev`
- the public `coders.mu` API remains the upstream data source and shared fallback
- CI runs on the shared core, the hosted API, the Raycast extension, and the macOS app

## Quick Start

Clone the repo and install dependencies:

```bash
pnpm install
pnpm build:all
```

If you want a one-shot bootstrap from a fresh clone:

```bash
pnpm bootstrap
```

Try the CLI from the repo root:

```bash
node dist/cli.mjs next
node dist/cli.mjs list
node dist/cli.mjs view next
```

Run the main repo checks:

```bash
pnpm check
npm run check:hosted-api
```

## Developer Installs

The intended developer flow is:

1. clone the repository
2. run `pnpm install`
3. run one target-specific install command from the repo root

### CLI

Build the workspace and link the CLI into your local shell:

```bash
pnpm install:cli
codersmu next
cmu next
```

This builds the shared core plus the CLI and then uses `npm link`, so the linked command is backed by your locally compiled checkout rather than a watch-mode process.

### macOS Menu Bar App

You need Xcode and `xcodegen` installed first. Then build the compiled Debug app from the repo root:

```bash
pnpm build:macos
pnpm run:macos
```

`pnpm build:macos` generates the Xcode project if needed and produces a local Debug app bundle at `apps/macos/.derived-data/Build/Products/Debug/CodersmuMenuBar.app`.

If you want to inspect or edit the project in Xcode directly:

```bash
pnpm open:macos
```

If `xcodegen` is missing, install it first:

```bash
brew install xcodegen
```

## Current Clients

### CLI

The CLI is the most complete client today.

- installable from GitHub
- commands exposed as `codersmu` and `cmu`
- uses the hosted API by default, with fallback to upstream data
- suitable for day-to-day use, though the command surface can still evolve

Install from the GitHub repository:

```bash
npm install -g github:cedpoilly/codersmu-clients#main
codersmu next
cmu next
```

Install from a tagged prototype snapshot:

```bash
npm install -g github:cedpoilly/codersmu-clients#v0.0.0-prototype.1
codersmu next
cmu next
```

GitHub installs compile the CLI from source during installation, so Node `>=20.11` is required.

Common commands:

```bash
codersmu next
codersmu previous
codersmu list
codersmu ls --short
codersmu past --short
codersmu refresh
codersmu next --refresh
codersmu list --state past --limit 5
codersmu view next
codersmu show next
codersmu view previous
codersmu view 2026-04-18-the-april-meetup
codersmu calendar next --write ./next-meetup.ics
codersmu calendar previous --write ./previous-meetup.ics
codersmu --help
codersmu --version
cmu next
cmu previous
```

The CLI refreshes meetup data automatically and uses a local cache internally. Users do not need to manage the cache themselves.

Use `--short` or `-s` for a more compact human-readable listing.
Use `--refresh` on read commands to bypass the local cache for that invocation.
Use `ls` and `show` as short aliases for `list` and `view`.

### macOS Menu Bar App

The macOS app lives in [`apps/macos`](./apps/macos/README.md).

- native SwiftUI `MenuBarExtra` app
- uses the hosted API first
- keeps its own persistence, change detection, and notification flow
- tested in CI, but packaging and distribution are still in progress

To work on it locally:

```bash
pnpm build:macos
pnpm run:macos
```

### Raycast

The Raycast extension lives in [`apps/raycast`](./apps/raycast/README.md).

- local extension prototype
- uses the same shared core as the CLI
- provides `Next Meetup` and `Meetups`
- not published to the Raycast Store yet

To run it locally:

```bash
cd apps/raycast
npm install
npm run dev
```

The `Meetups` command groups results into live, upcoming, and past sections and exposes quick actions for RSVP links, recordings, slides, maps, and calendar exports.

### Hosted API

The hosted API lives in [`apps/api`](./apps/api/README.md) and is deployed at [codersmu.cedpoilly.dev](https://codersmu.cedpoilly.dev).

- `GET /health`
- `GET /meetups?state=all|upcoming|past`
- `GET /meetups/next`
- `GET /meetups/:slug`

To smoke-test the live deployment from this repo:

```bash
npm run check:hosted-api
```

That probe validates:

- `GET /health`
- `HEAD /health`
- `GET /meetups?state=all`
- `GET /meetups?state=upcoming`
- `GET /meetups/next`
- detail lookup by both derived slug and raw meetup id

Set `CODERSMU_HOSTED_API_BASE_URL` first if you want to check a different deployment target. Use `CODERSMU_HOSTED_API_TIMEOUT_SECONDS` to tighten or relax the live probe timeout.

## Architecture

The shared core still uses the public `coders.mu` API at `https://coders.mu/api/public/v1/meetups` as its default source, but the shipped CLI, macOS app, and Raycast extension opt themselves into the hosted edge at `https://codersmu.cedpoilly.dev`. The hosted service itself reads from the same upstream JSON contract.

For a diagram-based system overview and per-client fallback documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

For hosted API operations, see [apps/api/RUNBOOK.md](./apps/api/RUNBOOK.md).

## Contributing

Contributions are welcome. The highest-value work right now is:

- CLI polish and UX consistency
- macOS app reliability and packaging
- Raycast quality, especially the `Next Meetup` flow
- hosted API resiliency and observability
- tests, fixtures, and contributor-facing docs

Start with [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, workflow, and pull request guidance.

Please also read:

- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

## Development

From the repository root:

```bash
pnpm install
pnpm build:all
pnpm check
npm run check:hosted-api
pnpm release:check
```

GitHub Actions run on pushes to `main` and pull requests. The main CI workflow covers the shared workspace checks, Raycast, macOS, and a deploy-artifact boot test for the hosted API.

## Roadmap

The long-term goal of `codersmu-clients` is not just to mirror website data in different shells. It is to make Coders.mu ambient in the developer workflow, visible at the right time and in the right place.

Current directions:

- new meetup announcement awareness
- RSVP opening and change detection
- richer native clients across platforms
- browser and agent surfaces that reduce manual checking
