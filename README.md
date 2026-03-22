# codersmu-clients

Workspace for Coders.mu clients.

Today, the installable client is the CLI at the repository root. The shared domain logic lives in `packages/core`, and `apps/raycast` contains an npm-managed Raycast extension skeleton.

The CLI exposes two commands: `codersmu` and `cmu`.

## Install

From GitHub:

```bash
npm install -g github:<owner>/<repo>#main
codersmu next
cmu next
```

From a GitHub tag:

```bash
npm install -g github:<owner>/<repo>#v0.0.0-prototype.1
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

## Release

Local release check:

```bash
pnpm release:check
```

GitHub Actions:

- `.github/workflows/ci.yml` runs install, typecheck, build, and `npm pack --dry-run`
- `.github/workflows/release.yml` publishes to npm when a GitHub Release is published

Before the first public release:

- create the GitHub repository and set it as this repo's remote
- add `repository`, `homepage`, and `bugs` fields to `package.json`
- create an npm access token and store it as `NPM_TOKEN` in the GitHub repository secrets
- decide whether to keep distribution GitHub-only or publish the CLI package to npm

## Future API integration

Replace the current scraper-backed provider with an HTTP-backed provider that maps the publisher endpoint to the shared `Meetup` type. The rest of the commands can stay unchanged.
