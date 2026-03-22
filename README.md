# codersmu-clients

Exploratory workspace for Coders.mu clients.

This repository is still in the exploratory phase. The CLI surface, internal package layout, scraper-backed data source, and integration strategy can all change while the product direction is still being tested.

## Current Clients

### CLI

The primary client today is the CLI at the repository root.

- installable from GitHub
- commands exposed as `codersmu` and `cmu`
- live data currently comes from scraping public pages
- intended as a prototype, not a stable release

### Raycast

The Raycast client lives in `apps/raycast`.

- local extension prototype
- currently shells out to the CLI instead of calling a stable API directly
- good enough for local experimentation
- not published to the Raycast Store yet

## Overall Status

- exploratory prototype, not a stable product
- GitHub-first distribution, no npm release yet
- scraper-backed data source can break if the website markup changes
- future HTTP/API integration is expected to replace the scraper

## CLI

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

The CLI refreshes public meetup data automatically and uses a local cache internally. Users do not need to manage the cache themselves.

Use `--short` or `-s` for a more compact human-readable listing.

## Raycast

The Raycast extension is currently a thin client on top of the CLI.

To run it locally:

```bash
pnpm build
cd apps/raycast
npm install
npm run dev
```

Then point the Raycast extension preference `CLI Path` to either:

- `cmu`
- `<repo-root>/dist/cli.mjs`

Current Raycast commands:

- `Next Meetup`
- `Meetups`

For more Raycast-specific notes, see `apps/raycast/README.md`.

## Future Roadmap

### Community Presence and In-Flow Awareness

The broader goal of `codersmu-clients` is not just to expose website data in different shells. It is to make sure developers stay present and informed about community events without having to manually check the website for updates.

This roadmap is centered on timely awareness:

- new meetup announcements
- RSVP openings and other time-sensitive windows
- location or schedule changes that people should notice quickly

| Pillar | Direction | Presence Value |
| --- | --- | --- |
| Social MCP (Model Context Protocol) Server | Bring `coders.mu` into AI coding agents so meetup information can appear directly inside the development workflow. A strong early use case is "shoulder-tap" notifications for new meetups, RSVP openings, and location changes. | Developers stay aware of community activity while already working with coding agents instead of discovering updates too late. |
| Native Desktop Apps (macOS/Windows/Linux) | Build dedicated desktop clients with system-level notifications and tray-icon alerts across platforms. | Developers get durable, OS-native signals for time-sensitive RSVP windows and event changes without keeping the website open. |
| Browser Extensions | Run active background polling with browser-native notifications for meetup updates and other community changes. | Developers who already spend most of their day in the browser can stay informed in-flow, with minimal friction and no manual refresh habit. |

Taken together, these clients aim to make Coders.mu ambient in the developer workflow: visible at the right time, in the right place, without requiring repeated manual checking.

## Workspace Layout

```text
.
├── apps/
│   └── raycast/
├── packages/
│   └── core/
└── src/
```

- `src/`: installable CLI package
- `packages/core`: shared meetup fetching, cache, calendar, and provider logic
- `apps/raycast`: npm-managed Raycast extension app

## Development

From the repository root:

```bash
pnpm install
pnpm build:all
node dist/cli.mjs next
node dist/cli.mjs previous
node dist/cli.mjs list
node dist/cli.mjs past --short
node dist/cli.mjs view next
pnpm release:check
```

GitHub Actions already exist for CI and a future npm release path, but npm publishing is intentionally deferred while the project remains exploratory.

## Future API Integration

The expected next architectural step is replacing the current scraper-backed provider with an HTTP-backed provider that maps the publisher endpoint to the shared `Meetup` type. The CLI and Raycast clients should then consume that shared model without changing their user-facing behavior too much.
