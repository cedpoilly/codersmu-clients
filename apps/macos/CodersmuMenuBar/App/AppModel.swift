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
  var debugHarness: DebugHarness

  @ObservationIgnored private let coordinator: RefreshCoordinator
  @ObservationIgnored private let scheduler: RefreshScheduler
  @ObservationIgnored private let preferencesStore: AppPreferencesStore
  @ObservationIgnored private let launchAtLoginManager: LaunchAtLoginManager
  @ObservationIgnored private var hasStarted = false

  init(
    coordinator: RefreshCoordinator,
    scheduler: RefreshScheduler,
    preferencesStore: AppPreferencesStore,
    launchAtLoginManager: LaunchAtLoginManager,
    debugHarness: DebugHarness
  ) {
    self.coordinator = coordinator
    self.scheduler = scheduler
    self.preferencesStore = preferencesStore
    self.launchAtLoginManager = launchAtLoginManager
    self.debugHarness = debugHarness

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

  func selectDebugSourceMode(_ mode: DebugSourceMode) async {
    debugHarness.sourceMode = mode

    if mode == .fixture {
      debugHarness.resetScenarioSession()
      snapshot = nil
      lastChange = nil
      lastRefreshAt = nil
    }

    await refresh()
  }

  func selectDebugScenario(_ scenario: DebugFixtureScenario) async {
    debugHarness.selectScenario(scenario)
    debugHarness.resetScenarioSession()
    snapshot = nil
    lastChange = nil
    lastRefreshAt = nil
    await refresh()
  }

  func advanceDebugScenario() async {
    debugHarness.advanceScenario()
    await refresh()
  }

  func replayDebugScenario() async {
    debugHarness.resetScenarioSession()
    snapshot = nil
    lastChange = nil
    lastRefreshAt = nil
    await refresh()
  }

  func clearDebugNotificationLog() {
    debugHarness.clearNotificationLog()
  }

  func clearDebugPersistedState() async {
    debugHarness.clearPersistedState()
    snapshot = nil
    lastChange = nil
    lastRefreshAt = nil
    await refresh()
  }

  private func persistPreferences() {
    preferencesStore.save(preferences)
  }
}
