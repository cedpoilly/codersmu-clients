# Contributing

Thanks for taking a look at `codersmu-clients`.

This repo is still evolving, so the most useful contributions are the ones that improve reliability, clarity, and day-to-day usability. Small fixes are welcome. Focused pull requests are much easier to review than broad refactors.

## Good Areas To Help

- CLI polish and JSON contract consistency
- macOS menu bar behavior, notifications, and packaging
- Raycast command quality, especially `Next Meetup`
- hosted API reliability, caching, and observability
- test coverage and fixture quality
- docs and contributor onboarding

## Local Setup

Requirements:

- Node `>=20.11`
- `pnpm`
- Xcode and `xcodebuild` if you want to work on the macOS app
- Raycast if you want to run the Raycast extension locally

Install dependencies from the repo root:

```bash
pnpm install
```

Build the workspace:

```bash
pnpm build:all
```

Run the main checks:

```bash
pnpm check
npm run check:hosted-api
```

## Project Layout

- `src/`: installable CLI package
- `packages/core`: shared fetching, cache, calendar, and response logic
- `apps/api`: hosted API
- `apps/macos`: native macOS app
- `apps/raycast`: Raycast extension

## Making Changes

Keep changes scoped. If you are touching shared logic in `packages/core`, sanity-check the client surfaces it feeds.

Useful commands:

```bash
pnpm check
pnpm --filter @codersmu/core test
pnpm --filter @codersmu/api test
cd apps/raycast && npm test
```

For macOS work:

```bash
xcodebuild -project apps/macos/CodersmuMenuBar.xcodeproj -scheme CodersmuMenuBar -configuration Debug CODE_SIGNING_ALLOWED=NO test
```

## Pull Requests

- Explain the user-visible effect of the change.
- Mention any tradeoffs or known follow-ups.
- Include the commands you ran to verify the change.
- Keep unrelated formatting or drive-by cleanup out of the PR unless it is directly relevant.

If the change affects the hosted API contract or client fallback behavior, call that out explicitly in the PR description.

## Questions And Proposals

If you want to make a larger change, open an issue or start a discussion in the PR early. That is especially helpful for:

- new client surfaces
- API contract changes
- shared cache or provider refactors
- packaging and release workflow changes
