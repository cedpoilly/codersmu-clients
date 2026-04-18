# Coders.mu Raycast

Raycast extension for browsing Coders.mu meetups from Raycast.

## Current Setup

This extension is still exploratory. It now reads meetup data through the shared Coders.mu core layer in this repository, using the same API-backed provider and cache model as the CLI.

If you want the extension to prefer the deployed hosted API at `https://codersmu.lepopquiz.app`, set `CODERSMU_HOSTED_API_BASE_URL` at runtime. Otherwise the shared core keeps using the public `coders.mu` API by default.

The default `npm run lint` command only runs local ESLint and Prettier checks so development is not blocked on Raycast Store metadata. Before publishing, replace the placeholder `author` in `package.json` with a valid Raycast Store username and run `npm run lint:strict`.

## Development

```bash
cd apps/raycast
npm install
npm run dev
```

`npm run dev`, `npm run build`, `npm run lint`, `npm run lint:strict`, and `npm run publish` all refresh the vendored core snapshot automatically when the shared source tree is available.

Available commands:

- `Next Meetup` for the next scheduled event, with refresh and fallback navigation to the full meetup list
- `Meetups` for a searchable live/upcoming/history browser with quick open and copy actions for meetup links, calendar exports, recordings, slides, maps, and parking details

## Store Notes

The extension folder is shaped for Raycast Store publishing:

- npm-managed with `package-lock.json`
- vendored shared-core snapshot under `vendor/core`
- Raycast manifest in `package.json`
- store build/lint scripts
- 512x512 icon asset
- root `README.md` and `CHANGELOG.md`

`npm run sync:core` refreshes the vendored snapshot from `../../packages/core/src` when that source exists. In a standalone Store-ready extension checkout, the existing vendored snapshot is used as-is.
