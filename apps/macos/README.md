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
cd apps/macos
xcodegen generate
```

## Open it in Xcode

```bash
open CodersmuMenuBar.xcodeproj
```

## Run tests

From the repository root:

```bash
xcodebuild -project apps/macos/CodersmuMenuBar.xcodeproj -scheme CodersmuMenuBar -configuration Debug CODE_SIGNING_ALLOWED=NO test
```

## Status

The app is actively developed and tested in CI. Packaging and end-user distribution are still being finalized.
