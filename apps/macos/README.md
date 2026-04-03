# Coders.mu macOS App

Local scaffold for the native macOS menu bar client described in the macOS PRD and architecture draft.

Current scope:

- SwiftUI `MenuBarExtra` app shell
- `@Observable` app model
- CLI-backed meetup source, plus persistence, change detection, notification, and refresh services
- settings surface for launch-at-login, quiet hours, and snoozing
- generated Xcode project via `xcodegen`

## Generate the project

```bash
cd apps/macos
xcodegen generate
```

## Current limitation

This repo currently has Command Line Tools selected instead of full Xcode, so project generation works locally but `xcodebuild` does not until Xcode is installed and selected.
