import Foundation
@preconcurrency import UserNotifications

final class UserNotificationService: NotificationService {
  private let center: UNUserNotificationCenter

  init(center: UNUserNotificationCenter = .current()) {
    self.center = center
  }

  func requestAuthorization() async {
    do {
      _ = try await center.requestAuthorization(options: [.alert, .badge, .sound])
    } catch {
      AppLog.notifications.error("Notification authorization failed: \(error.localizedDescription)")
    }
  }

  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async -> [NotificationDeliveryResult] {
    var results: [NotificationDeliveryResult] = []

    for event in events {
      let result = await scheduleNotification(
        title: "Coders.mu Update",
        body: event.summary,
        identifier: event.fingerprint,
        meetupURL: snapshot.meetupURL,
        preferences: preferences
      )
      results.append(result)
    }

    return results
  }

  func notificationDebugState() async -> NotificationDebugState {
    await withCheckedContinuation { continuation in
      center.getNotificationSettings { settings in
        continuation.resume(returning: NotificationDebugState(
          authorizationState: Self.mapAuthorizationStatus(settings.authorizationStatus),
          alertsEnabled: settings.alertSetting == .enabled,
          soundsEnabled: settings.soundSetting == .enabled,
          notificationCenterEnabled: settings.notificationCenterSetting == .enabled
        ))
      }
    }
  }

  func sendTestNotification(preferences: AppPreferences) async -> NotificationDeliveryResult {
    await scheduleNotification(
      title: "Coders.mu Test Notification",
      body: "If you can read this banner, macOS notifications are working for the app.",
      identifier: "debug.test.\(UUID().uuidString.lowercased())",
      meetupURL: URL(string: "https://coders.mu")!,
      preferences: preferences
    )
  }

  private func scheduleNotification(
    title: String,
    body: String,
    identifier: String,
    meetupURL: URL,
    preferences: AppPreferences
  ) async -> NotificationDeliveryResult {
    guard shouldDeliverNotifications(now: Date(), preferences: preferences) else {
      return .suppressed("Notification suppressed by pause, snooze, or quiet hours.")
    }

    let settings = await notificationDebugState()
    guard settings.authorizationState != .denied else {
      return .failed("Notifications are denied for Coders.mu in macOS.")
    }

    if settings.authorizationState == .notDetermined {
      await requestAuthorization()
      let refreshedSettings = await notificationDebugState()
      guard refreshedSettings.authorizationState != .notDetermined else {
        return .failed("Notification permission is still pending. If no prompt appeared, try clicking Request Notification Permission.")
      }

      guard refreshedSettings.authorizationState != .denied else {
        return .failed("Notifications were denied for Coders.mu in macOS.")
      }
    }

    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    content.userInfo = ["meetupURL": meetupURL.absoluteString]

    let request = UNNotificationRequest(
      identifier: identifier,
      content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
    )

    do {
      try await center.add(request)
      return .scheduled("Notification scheduled. macOS should show it in about 1 second.")
    } catch {
      AppLog.notifications.error("Failed to schedule notification: \(error.localizedDescription)")
      return .failed("macOS rejected the notification request: \(error.localizedDescription)")
    }
  }

  private func shouldDeliverNotifications(now: Date, preferences: AppPreferences) -> Bool {
    if preferences.notificationsPaused || preferences.isSnoozed {
      return false
    }

    if preferences.quietHoursEnabled && preferences.quietHours.contains(now) {
      return false
    }

    return true
  }

  nonisolated private static func mapAuthorizationStatus(_ status: UNAuthorizationStatus) -> NotificationAuthorizationState {
    switch status {
    case .notDetermined:
      return .notDetermined
    case .denied:
      return .denied
    case .authorized:
      return .authorized
    case .provisional:
      return .provisional
    case .ephemeral:
      return .ephemeral
    @unknown default:
      return .unsupported
    }
  }
}
