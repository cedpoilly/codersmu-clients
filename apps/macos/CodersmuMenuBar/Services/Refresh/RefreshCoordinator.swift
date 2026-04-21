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
  var debugSummary: String?
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

  func notificationServiceDebugState() async -> NotificationDebugState {
    await notificationService.notificationDebugState()
  }

  func sendTestNotification(preferences: AppPreferences) async -> NotificationDeliveryResult {
    await notificationService.sendTestNotification(preferences: preferences)
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

  func simulate(
    previousSnapshot: MeetupSnapshot?,
    latestSnapshot: MeetupSnapshot?,
    preferences: AppPreferences
  ) async -> RefreshOutcome {
    await processRefreshResult(
      latestSnapshot: latestSnapshot,
      trigger: .manual,
      preferences: preferences,
      previousSnapshotOverride: previousSnapshot,
      existingFingerprintsOverride: [],
      persistResult: false
    )
  }

  private func processRefreshResult(
    latestSnapshot: MeetupSnapshot?,
    trigger: RefreshTrigger,
    preferences: AppPreferences,
    previousSnapshotOverride: MeetupSnapshot? = nil,
    existingFingerprintsOverride: Set<String>? = nil,
    persistResult: Bool = true
  ) async -> RefreshOutcome {
    let now = Date()
    var state = (try? snapshotStore.loadState()) ?? .empty

    let previousSnapshot = previousSnapshotOverride ?? state.snapshot

    guard let latestSnapshot else {
      if persistResult {
        state.snapshot = nil
        state.lastRefreshAt = now
        do {
          try snapshotStore.saveState(state)
        } catch {
          return handleRefreshError(error, state: state)
        }
      }

      return RefreshOutcome(
        snapshot: nil,
        events: [],
        lastRefreshAt: now,
        errorDescription: nil,
        debugSummary: "Refresh completed. No upcoming meetup was returned."
      )
    }

    let existingFingerprints = existingFingerprintsOverride ?? (
      previousSnapshot?.changeIdentity == latestSnapshot.changeIdentity
        ? state.deliveredFingerprints
        : Set<String>()
    )

    let detectedEvents = changeDetector.detectChanges(from: previousSnapshot, to: latestSnapshot)
    let freshEvents = detectedEvents.filter { !existingFingerprints.contains($0.fingerprint) }

    let deliveryResults = await notificationService.notify(
      events: freshEvents,
      snapshot: latestSnapshot,
      preferences: preferences
    )

    if persistResult {
      state.snapshot = latestSnapshot
      state.lastRefreshAt = now
      state.deliveredFingerprints = existingFingerprints.union(freshEvents.map(\.fingerprint))
      do {
        try snapshotStore.saveState(state)
      } catch {
        return handleRefreshError(error, state: state)
      }
    }

    AppLog.refresh.debug("Refresh completed via \(trigger.rawValue).")

    return RefreshOutcome(
      snapshot: latestSnapshot,
      events: freshEvents,
      lastRefreshAt: now,
      errorDescription: nil,
      debugSummary: makeDebugSummary(
        detectedEvents: detectedEvents,
        freshEvents: freshEvents,
        deliveryResults: deliveryResults
      )
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
        errorDescription: "Couldn't refresh Coders.mu right now.",
        debugSummary: "Refresh failed: \(error.localizedDescription)"
      )
    }

    AppLog.refresh.error("Refresh failed: \(error.localizedDescription)")

    return RefreshOutcome(
      snapshot: resolvedState.snapshot,
      events: [],
      lastRefreshAt: now,
      errorDescription: "Couldn't refresh Coders.mu right now.",
      debugSummary: "Refresh failed: \(error.localizedDescription)"
    )
  }

  private func makeDebugSummary(
    detectedEvents: [MeetupChangeEvent],
    freshEvents: [MeetupChangeEvent],
    deliveryResults: [NotificationDeliveryResult]
  ) -> String {
    if detectedEvents.isEmpty {
      return "Refresh completed. No tracked changes detected."
    }

    if freshEvents.isEmpty {
      let summaries = detectedEvents.map(\.summary).joined(separator: " | ")
      return "Refresh completed. Change already notified earlier: \(summaries)"
    }

    let scheduledCount = deliveryResults.filter { $0.kind == .scheduled }.count
    let suppressedCount = deliveryResults.filter { $0.kind == .suppressed }.count
    let failedCount = deliveryResults.filter { $0.kind == .failed }.count
    let summaries = freshEvents.map(\.summary).joined(separator: " | ")

    return "Detected \(freshEvents.count) tracked change(s): \(summaries). Notifications: \(scheduledCount) scheduled, \(suppressedCount) suppressed, \(failedCount) failed."
  }
}
