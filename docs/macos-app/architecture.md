# Coders.mu macOS App Architecture

## Summary

The recommended first version is a native macOS menu bar utility built with SwiftUI. The hard part of the app is not the UI. It is reliable change detection, notification deduplication, and graceful handling of incomplete upstream data.

## Core Decisions

### App Shape

- menu bar-only app for MVP
- SwiftUI `MenuBarExtra`
- agent-style app behavior with `LSUIElement=true`
- no main dashboard window in v1
- clicking the menu bar icon opens the app's compact menu/popup surface only

### Data Boundary

The app should define a native `MeetupSource` protocol and isolate all upstream fetching behind it.

That gives us:

- one place to talk to the current public source
- one future swap point when the backend exists
- no source-specific logic leaking into the UI

### Persistence

No database for MVP.

Use:

- `AppStorage` / UserDefaults for preferences
- JSON files in Application Support for:
  - last snapshot
  - notification ledger
  - refresh metadata

This app tracks one active meetup and a small event ledger, so a database would add unnecessary weight.

### Event Model

The app should normalize the next meetup into a stable internal snapshot, compare it against the last persisted snapshot, and emit typed change events.

Examples:

- `nextMeetupCreated`
- `dateConfirmed`
- `dateChanged`
- `locationConfirmed`
- `locationChanged`
- `rsvpOpened`
- `seatThresholdReached`
- `meetupCanceledOrPostponed`

Sponsor and speaker announcement notifications are intentionally deferred until after MVP, even though the architecture can support them later.

### Notifications

Use `UNUserNotificationCenter` for local notifications.

Important rules:

- notify only from normalized events
- suppress duplicate notifications through event fingerprints
- do not treat placeholder-to-placeholder transitions like `TBD -> TBD` as meaningful changes
- notification taps should always open the meetup page in the default browser
- notification routing should not depend on the popover being open

### State Management

Use one `@Observable` app model as the UI-facing source of truth.

Views should:

- read observable state
- call intent methods
- never fetch, parse, persist, or classify data directly

## Service Boundaries

Recommended service layers:

- `MeetupSource`
- `SnapshotStore`
- `ChangeDetector`
- `NotificationService`
- `RefreshScheduler`
- `RefreshCoordinator`

Responsibilities:

- `MeetupSource`: fetch and normalize upstream data
- `SnapshotStore`: persist and load app state
- `ChangeDetector`: classify meaningful changes
- `NotificationService`: send native notifications
- `RefreshScheduler`: decide when refreshes happen
- `RefreshCoordinator`: run one end-to-end refresh flow

## Project Structure

Recommended app location:

```text
apps/macos/
├── README.md
├── CodersmuMenuBar.xcodeproj/
├── CodersmuMenuBar/
│   ├── App/
│   ├── Models/
│   ├── Features/
│   │   ├── MenuBar/
│   │   ├── NextMeetup/
│   │   └── Settings/
│   ├── Services/
│   │   ├── Source/
│   │   ├── Persistence/
│   │   ├── ChangeDetection/
│   │   ├── Notifications/
│   │   ├── Refresh/
│   │   └── Logging/
│   ├── Support/
│   └── Assets.xcassets/
├── CodersmuMenuBarTests/
└── CodersmuMenuBarUITests/
```

## Data Flow

1. A scheduled or manual refresh begins.
2. The source fetches and normalizes the next meetup.
3. The snapshot store loads the previous snapshot and notification ledger.
4. The change detector emits meaningful events.
5. The notification service sends allowed notifications.
6. The snapshot store saves the new snapshot and updated ledger.
7. The app model publishes the new UI state.

## Constraints

- The current data source is still scraper-backed.
- Some upstream values may remain `TBD` for long periods.
- Notification trust is fragile and must be protected aggressively.
- Full Xcode is required locally for native development.

## Locked Product Decisions

- The first release stays menu bar-only.
- Notification taps always open the meetup page in the default browser.
- Seat-threshold notifications are part of v1.
- Launch-at-login is part of the first release.
- Quiet hours and snoozing are part of the first release.
- Sponsor and speaker notifications are deferred until after MVP.

## Implementation Priority

1. Native app shell and menu bar behavior
2. Normalized snapshot models and source abstraction
3. Snapshot persistence and notification ledger
4. Change detection engine
5. Notification service and permissions
6. Popover UI and settings
7. Launch-at-login and refresh controls
