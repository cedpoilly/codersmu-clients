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

  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async {
    guard shouldDeliverNotifications(now: Date(), preferences: preferences) else {
      return
    }

    for event in events {
      let content = UNMutableNotificationContent()
      content.title = "Coders.mu Update"
      content.body = event.summary
      content.sound = .default
      content.userInfo = ["meetupURL": snapshot.meetupURL.absoluteString]

      let request = UNNotificationRequest(
        identifier: event.fingerprint,
        content: content,
        trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
      )

      do {
        try await center.add(request)
      } catch {
        AppLog.notifications.error("Failed to schedule notification: \(error.localizedDescription)")
      }
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
}
