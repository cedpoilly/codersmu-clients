# Coders.mu macOS App

Local scaffold for the native macOS menu bar client described in the macOS PRD and architecture draft.

Current scope:

- SwiftUI `MenuBarExtra` app shell
- `@Observable` app model
- CLI-backed meetup source, plus persistence, change detection, notification, and refresh services
- settings surface for launch-at-login, quiet hours, and snoozing
- generated Xcode project via `xcodegen`

## Requirements

- full Xcode installed at `/Applications/Xcode.app`
- `xcodegen` available on `PATH`

## Start the dev app

```bash
pnpm macos:dev
```

This command:

- regenerates the Xcode project from [project.yml](/Users/cedricpoilly/.codex/worktrees/7712/codersmu-clients/apps/macos/project.yml)
- builds the Debug app into `apps/macos/build-derived`
- kills any previously running `CodersmuMenuBar` process
- opens a single fresh instance from that visible build path

Use this path on purpose. Notification Center has been more reliable about showing the correct app icon when the debug app is launched from `apps/macos/build-derived` rather than a hidden artifact folder.

If you need a clean rebuild first:

```bash
pnpm macos:dev:clean
```

## Debug build behavior

- Debug uses bundle id `mu.coders.CodersmuMenuBar.Debug`
- Release keeps `mu.coders.CodersmuMenuBar`
- old notifications in Notification Center do not repaint when the icon changes; only new notifications show the new icon
