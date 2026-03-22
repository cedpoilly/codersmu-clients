# Coders.mu Raycast

Raycast extension for browsing Coders.mu meetups from Raycast.

## Current Setup

This extension is still exploratory. It currently shells out to the Coders.mu CLI instead of calling the website directly. That keeps the extension thin while the CLI and data model are still evolving.

Before running the extension:

1. Build or install the CLI.
2. Replace the placeholder `author` in `package.json` with your real Raycast username before publishing or running `npm run lint`.
3. Point the extension to the CLI executable through the `CLI Path` preference, or make sure `cmu` is available on your `PATH`.

Examples from the repository root:

```bash
pnpm build
```

Use one of these values in the Raycast preference:

- `cmu`
- `<repo-root>/dist/cli.mjs`

## Development

```bash
cd apps/raycast
npm install
npm run dev
```

## Store Notes

The extension folder is shaped for Raycast Store publishing:

- npm-managed with `package-lock.json`
- Raycast manifest in `package.json`
- store build/lint scripts
- 512x512 icon asset
- root `README.md` and `CHANGELOG.md`

For a public store submission, the next step should be removing the CLI dependency and calling a stable API or shared published package directly.
