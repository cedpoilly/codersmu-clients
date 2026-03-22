# codersmu-clients

Exploratory workspace for Coders.mu clients.

This repository is still in the exploratory phase. The command surface, internal package layout, scraper-backed data source, and integration strategy can all change while the product direction is still being tested.

Today, the installable client is the CLI at the repository root. The shared domain logic lives in `packages/core`, and `apps/raycast` contains an npm-managed Raycast extension skeleton.

The CLI exposes two commands: `codersmu` and `cmu`.

## Status

- exploratory prototype, not a stable release
- GitHub-first distribution, no npm release yet
- live data currently comes from scraping public pages, so breakage is possible if the site markup changes
- Raycast support exists as a local extension skeleton and is not store-ready yet

## Install

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

GitHub installs compile the CLI from source during installation, so Node `>=20.11` is still required.

There is no native binary in the release flow yet. If we decide to support people without Node later, we can attach macOS/Linux/Windows binaries to GitHub Releases as a separate distribution channel.

## Workspace Layout

```text
.
├── apps/
│   └── raycast/
├── packages/
│   └── core/
└── src/
```

- `src/`: the installable CLI package
- `packages/core`: shared meetup fetching, cache, calendar, and provider logic
- `apps/raycast`: npm-managed Raycast extension app

## Commands

```bash
codersmu next
codersmu previous
codersmu list
codersmu past --short
codersmu list --state past --limit 5
codersmu view next
codersmu view previous
codersmu view 2026-04-18-the-april-meetup
codersmu calendar next --write ./next-meetup.ics
codersmu calendar previous --write ./previous-meetup.ics
cmu next
cmu previous
```

The CLI refreshes public meetup data automatically and uses a local cache internally. Users do not need to manage the cache.

Use `--short` or `-s` for a more compact human-readable listing.

## Development

```bash
pnpm install
pnpm build:all
node dist/cli.mjs next
node dist/cli.mjs previous
node dist/cli.mjs list
node dist/cli.mjs past --short
node dist/cli.mjs view next
```

## GitHub Repo

This repository is intended to stay GitHub-first until the CLI surface and the future publisher API are clearer. Treat tags as prototype checkpoints, not stable releases.

Local release check:

```bash
pnpm release:check
```

GitHub Actions currently exist for CI and a future npm release path, but npm publishing is intentionally deferred while the project remains exploratory.

## Future API integration

Replace the current scraper-backed provider with an HTTP-backed provider that maps the publisher endpoint to the shared `Meetup` type. The rest of the commands can stay unchanged.
