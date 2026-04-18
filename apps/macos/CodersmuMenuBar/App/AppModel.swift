import Foundation
import Observation

enum RefreshState: Equatable {
  case idle
  case refreshing
  case failed(String)
}

enum MenuBarLabelState {
  case normal
  case refreshing
  case muted
  case error

  var accessibilityLabel: String {
    switch self {
    case .normal:
      return "Coders.mu"
    case .refreshing:
      return "Coders.mu, refreshing"
    case .muted:
      return "Coders.mu, notifications muted"
    case .error:
      return "Coders.mu, refresh failed"
    }
  }
}

@MainActor
@Observable
final class AppModel {
  var snapshot: MeetupSnapshot?
  var lastChange: MeetupChangeEvent?
  var lastRefreshAt: Date?
  var refreshState: RefreshState = .idle
  var preferences: AppPreferences
  var launchAtLoginErrorMessage: String?

  @ObservationIgnored private let coordinator: RefreshCoordinator
  @ObservationIgnored private let scheduler: RefreshScheduler
  @ObservationIgnored private let preferencesStore: AppPreferencesStore
  @ObservationIgnored private let launchAtLoginManager: LaunchAtLoginManager
  @ObservationIgnored private var hasStarted = false

  init(
    coordinator: RefreshCoordinator,
    scheduler: RefreshScheduler,
    preferencesStore: AppPreferencesStore,
    launchAtLoginManager: LaunchAtLoginManager
  ) {
    self.coordinator = coordinator
    self.scheduler = scheduler
    self.preferencesStore = preferencesStore
    self.launchAtLoginManager = launchAtLoginManager

    var loadedPreferences = preferencesStore.load()
    loadedPreferences.launchAtLoginEnabled = launchAtLoginManager.isEnabled()
    self.preferences = loadedPreferences
  }

  var menuBarLabelState: MenuBarLabelState {
    if preferences.notificationsPaused || preferences.isSnoozed {
      return .muted
    }

    switch refreshState {
    case .refreshing:
      return .refreshing
    case .failed:
      return .error
    case .idle:
      return .normal
    }
  }

  var isNotificationsEffectivelyMuted: Bool {
    preferences.notificationsPaused || preferences.isSnoozed
  }

  var isRefreshing: Bool {
    if case .refreshing = refreshState {
      return true
    }

    return false
  }

  var refreshStatusText: String {
    switch refreshState {
    case .idle:
      guard let lastRefreshAt else {
        return "Waiting for the first refresh."
      }

      return "Last updated \(lastRefreshAt.formatted(date: .abbreviated, time: .shortened))."
    case .refreshing:
      return "Refreshing meetup data…"
    case .failed(let message):
      return message
    }
  }

  func start() async {
    guard !hasStarted else {
      return
    }

    hasStarted = true
    await refresh(trigger: .appLaunch)
    scheduler.start()
    await coordinator.requestNotificationAuthorization()
  }

  func refresh(trigger: RefreshTrigger = .manual) async {
    refreshState = .refreshing

    let outcome = await coordinator.refresh(trigger: trigger, preferences: preferences)
    snapshot = outcome.snapshot
    lastRefreshAt = outcome.lastRefreshAt
    if let newestEvent = outcome.events.first {
      lastChange = newestEvent
    }

    if let errorDescription = outcome.errorDescription {
      refreshState = .failed(errorDescription)
    } else {
      refreshState = .idle
      launchAtLoginErrorMessage = nil
    }
  }

  func setNotificationsPaused(_ isPaused: Bool) {
    preferences.notificationsPaused = isPaused
    if !isPaused {
      preferences.snoozedUntil = nil
    }
    persistPreferences()
  }

  func setQuietHoursEnabled(_ isEnabled: Bool) {
    preferences.quietHoursEnabled = isEnabled
    persistPreferences()
  }

  func setQuietHoursStartHour(_ hour: Int) {
    preferences.quietHours.startHour = hour
    persistPreferences()
  }

  func setQuietHoursEndHour(_ hour: Int) {
    preferences.quietHours.endHour = hour
    persistPreferences()
  }

  func setLaunchAtLoginEnabled(_ isEnabled: Bool) {
    do {
      try launchAtLoginManager.setEnabled(isEnabled)
      preferences.launchAtLoginEnabled = isEnabled
      launchAtLoginErrorMessage = nil
      persistPreferences()
    } catch {
      launchAtLoginErrorMessage = "Couldn't update launch at login for this build."
    }
  }

  func snoozeForOneHour() {
    preferences.snoozedUntil = Calendar.current.date(byAdding: .hour, value: 1, to: Date())
    preferences.notificationsPaused = false
    persistPreferences()
  }

  func snoozeUntilTomorrowMorning() {
    let calendar = Calendar.current
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    let startOfTomorrow = calendar.startOfDay(for: tomorrow)
    preferences.snoozedUntil = calendar.date(byAdding: .hour, value: 8, to: startOfTomorrow)
    preferences.notificationsPaused = false
    persistPreferences()
  }

  func clearSnooze() {
    preferences.snoozedUntil = nil
    persistPreferences()
  }

  func simulateDeveloperEvent(_ event: DeveloperInjectedEvent) async {
    refreshState = .refreshing

    let baselineSnapshot: MeetupSnapshot?
    if let snapshot {
      baselineSnapshot = snapshot
    } else if event == .nextMeetupCreated {
      baselineSnapshot = nil
    } else {
      do {
        baselineSnapshot = try await coordinator.fetchLatestSnapshot()
      } catch {
        refreshState = .failed("Couldn't load live meetup data for the simulation.")
        return
      }
    }

    guard let simulatedSnapshot = event.applying(to: baselineSnapshot) else {
      refreshState = .failed("Couldn't load live meetup data for the simulation.")
      return
    }

    let outcome = await coordinator.refresh(
      trigger: .manual,
      preferences: preferences,
      latestSnapshot: simulatedSnapshot
    )

    snapshot = outcome.snapshot
    lastRefreshAt = outcome.lastRefreshAt
    if let newestEvent = outcome.events.first {
      lastChange = newestEvent
    }

    if let errorDescription = outcome.errorDescription {
      refreshState = .failed(errorDescription)
    } else {
      refreshState = .idle
      launchAtLoginErrorMessage = nil
    }
  }

  private func persistPreferences() {
    preferencesStore.save(preferences)
  }
}
