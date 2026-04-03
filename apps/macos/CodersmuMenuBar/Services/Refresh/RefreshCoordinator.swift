import Foundation

enum RefreshTrigger: String {
  case appLaunch
  case manual
  case scheduled
}

struct RefreshOutcome {
  var snapshot: MeetupSnapshot?
  var events: [MeetupChangeEvent]
  var lastRefreshAt: Date
  var errorDescription: String?
}

@MainActor
struct RefreshCoordinator {
  let source: any MeetupSource
  let snapshotStore: any SnapshotStore
  let changeDetector: ChangeDetector
  let notificationService: any NotificationService

  func requestNotificationAuthorization() async {
    await notificationService.requestAuthorization()
  }

  func refresh(trigger: RefreshTrigger, preferences: AppPreferences) async -> RefreshOutcome {
    let now = Date()
    var state = (try? snapshotStore.loadState()) ?? .empty

    do {
      let latestSnapshot = try await source.fetchNextMeetup()
      let previousSnapshot = state.snapshot

      guard let latestSnapshot else {
        state.snapshot = nil
        state.lastRefreshAt = now
        try? snapshotStore.saveState(state)
        return RefreshOutcome(snapshot: nil, events: [], lastRefreshAt: now, errorDescription: nil)
      }

      let existingFingerprints = previousSnapshot?.slug == latestSnapshot.slug
        ? state.deliveredFingerprints
        : Set<String>()

      let detectedEvents = changeDetector.detectChanges(from: previousSnapshot, to: latestSnapshot)
      let freshEvents = detectedEvents.filter { !existingFingerprints.contains($0.fingerprint) }

      await notificationService.notify(events: freshEvents, snapshot: latestSnapshot, preferences: preferences)

      state.snapshot = latestSnapshot
      state.lastRefreshAt = now
      state.deliveredFingerprints = existingFingerprints.union(freshEvents.map(\.fingerprint))
      try snapshotStore.saveState(state)

      AppLog.refresh.debug("Refresh completed via \(trigger.rawValue).")

      return RefreshOutcome(
        snapshot: latestSnapshot,
        events: freshEvents,
        lastRefreshAt: now,
        errorDescription: nil
      )
    } catch {
      state.lastRefreshAt = now
      try? snapshotStore.saveState(state)
      AppLog.refresh.error("Refresh failed: \(error.localizedDescription)")

      return RefreshOutcome(
        snapshot: state.snapshot,
        events: [],
        lastRefreshAt: now,
        errorDescription: "Couldn't refresh Coders.mu right now."
      )
    }
  }
}
