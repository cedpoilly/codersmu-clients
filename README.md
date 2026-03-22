# codersmu

CLI for consulting public meetup data from the `coders.mu` website.

The package exposes two commands: `codersmu` and `cmu`.

## Install

From npm:

```bash
npm install -g codersmu
codersmu next
cmu next
```

One-off execution from the registry:

```bash
npx codersmu@latest next
pnpm dlx codersmu next
bunx codersmu next
```

From a GitHub repository tag:

```bash
npm install -g github:<owner>/<repo>#v0.1.0
codersmu next
cmu next
```

GitHub installs compile the CLI from source during installation, so Node `>=20.11` is still required.

There is no native binary in the release flow yet. The first release track is an npm package. If we decide to support people without Node later, we can attach macOS/Linux/Windows binaries to GitHub Releases as a separate distribution channel.

## Why this stack

- Node.js CLI published on npm so it works with `npx`, `pnpm dlx`, `yarn dlx`, and `bunx`
- TypeScript for maintainability and future API client typing
- Zero runtime dependencies to keep the package small and startup time fast
- Automatic data refresh with a local cache hidden behind the CLI
- A `MeetupProvider` abstraction so the scraper can later be replaced by an official public endpoint

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
pnpm build
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

Before the first real release:

- create the GitHub repository and set it as this repo's remote
- add `repository`, `homepage`, and `bugs` fields to `package.json`
- create an npm access token and store it as `NPM_TOKEN` in the GitHub repository secrets
- publish `v0.1.0` from a Git tag or GitHub Release

## Future API integration

Replace the current scraper-backed provider with an HTTP-backed provider that maps the publisher endpoint to the shared `Meetup` type. The rest of the commands can stay unchanged.
