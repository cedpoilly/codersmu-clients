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

  func fetchLatestSnapshot() async throws -> MeetupSnapshot? {
    try await source.fetchNextMeetup()
  }

  func requestNotificationAuthorization() async {
    await notificationService.requestAuthorization()
  }

  func refresh(trigger: RefreshTrigger, preferences: AppPreferences) async -> RefreshOutcome {
    do {
      let latestSnapshot = try await source.fetchNextMeetup()
      return await processRefreshResult(
        latestSnapshot: latestSnapshot,
        trigger: trigger,
        preferences: preferences
      )
    } catch {
      return handleRefreshError(error)
    }
  }

  func refresh(
    trigger: RefreshTrigger,
    preferences: AppPreferences,
    latestSnapshot: MeetupSnapshot?
  ) async -> RefreshOutcome {
    await processRefreshResult(
      latestSnapshot: latestSnapshot,
      trigger: trigger,
      preferences: preferences
    )
  }

  private func processRefreshResult(
    latestSnapshot: MeetupSnapshot?,
    trigger: RefreshTrigger,
    preferences: AppPreferences
  ) async -> RefreshOutcome {
    let now = Date()
    var state = (try? snapshotStore.loadState()) ?? .empty

    let previousSnapshot = state.snapshot

    guard let latestSnapshot else {
      state.snapshot = nil
      state.lastRefreshAt = now
      do {
        try snapshotStore.saveState(state)
      } catch {
        return handleRefreshError(error, state: state)
      }

      return RefreshOutcome(snapshot: nil, events: [], lastRefreshAt: now, errorDescription: nil)
    }

    let existingFingerprints = previousSnapshot?.changeIdentity == latestSnapshot.changeIdentity
      ? state.deliveredFingerprints
      : Set<String>()

    let detectedEvents = changeDetector.detectChanges(from: previousSnapshot, to: latestSnapshot)
    let freshEvents = detectedEvents.filter { !existingFingerprints.contains($0.fingerprint) }

    await notificationService.notify(events: freshEvents, snapshot: latestSnapshot, preferences: preferences)

    state.snapshot = latestSnapshot
    state.lastRefreshAt = now
    state.deliveredFingerprints = existingFingerprints.union(freshEvents.map(\.fingerprint))
    do {
      try snapshotStore.saveState(state)
    } catch {
      return handleRefreshError(error, state: state)
    }

    AppLog.refresh.debug("Refresh completed via \(trigger.rawValue).")

    return RefreshOutcome(
      snapshot: latestSnapshot,
      events: freshEvents,
      lastRefreshAt: now,
      errorDescription: nil
    )
  }

  private func handleRefreshError(_ error: Error, state: PersistedAppState? = nil) -> RefreshOutcome {
    let now = Date()
    var resolvedState = state ?? ((try? snapshotStore.loadState()) ?? .empty)
    resolvedState.lastRefreshAt = now

    do {
      try snapshotStore.saveState(resolvedState)
    } catch let saveError {
      AppLog.refresh.error("Refresh failed: \(error.localizedDescription). State save also failed: \(saveError.localizedDescription)")
      return RefreshOutcome(
        snapshot: resolvedState.snapshot,
        events: [],
        lastRefreshAt: now,
        errorDescription: "Couldn't refresh Coders.mu right now."
      )
    }

    AppLog.refresh.error("Refresh failed: \(error.localizedDescription)")

    return RefreshOutcome(
      snapshot: resolvedState.snapshot,
      events: [],
      lastRefreshAt: now,
      errorDescription: "Couldn't refresh Coders.mu right now."
    )
  }
}
