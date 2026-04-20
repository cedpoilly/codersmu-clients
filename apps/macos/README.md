# Coders.mu macOS App

Native macOS menu bar client for Coders.mu meetup awareness.

Current scope:

- SwiftUI `MenuBarExtra` app shell
- `@Observable` app model
- HTTP-backed meetup source, plus persistence, change detection, notification, and refresh services
- settings surface for launch-at-login, quiet hours, and snoozing
- generated Xcode project via `xcodegen`

## Generate the project

```bash
pnpm install:macos
```

You usually do not need to run this directly, because `pnpm build:macos` will generate the project first when needed.

## Build the compiled Debug app

```bash
pnpm build:macos
```

The built app bundle is written to:

```text
apps/macos/.derived-data/Build/Products/Debug/CodersmuMenuBar.app
```

## Run the compiled app

```bash
pnpm run:macos
```

This launches the last built Debug app bundle. It does not rebuild automatically.

## Open it in Xcode

```bash
pnpm dev:open:macos
```

These root-level shortcuts assume you are running from the repository root. If you prefer manual commands inside `apps/macos`, `xcodegen generate` and `xcodebuild` still work the same way.

## Run tests

From the repository root:

```bash
xcodebuild -project apps/macos/CodersmuMenuBar.xcodeproj -scheme CodersmuMenuBar -configuration Debug CODE_SIGNING_ALLOWED=NO test
```

## Build a signed release package

The repository now includes a packaging script for a signed, notarized macOS zip:

```bash
pnpm macos:package
```

Required environment:

- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID` for team API keys
- `APP_STORE_CONNECT_KEY_PATH`
- a `Developer ID Application` certificate installed in the active keychain

The script writes artifacts to `apps/macos/dist/` and produces:

- a signed `CodersmuMenuBar-<version>-<build>.zip`
- a matching `dSYM` zip when available

Set `CODERSMU_MACOS_SKIP_NOTARIZATION=1` only if you intentionally want a signed-but-not-notarized local package.

## GitHub release automation

The `Release` workflow can now build and upload the notarized macOS zip automatically when these repository secrets are configured:

- `MACOS_DEVELOPER_ID_P12_BASE64`
- `MACOS_DEVELOPER_ID_P12_PASSWORD`
- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID` for team API keys
- `APP_STORE_CONNECT_KEY_P8_BASE64`

## Status

The app is actively developed and tested in CI. The repo now has a signed/notarized packaging path, but you still need valid Apple signing secrets to produce distributable artifacts.
