import Foundation
import UserNotifications

final class UserNotificationService: NotificationService {
  static let openMeetupActionIdentifier = "OPEN_MEETUP"
  static let openRSVPActionIdentifier = "OPEN_RSVP"
  static let meetupOnlyCategoryIdentifier = "MEETUP_ONLY"
  static let meetupAndRSVPCategoryIdentifier = "MEETUP_AND_RSVP"

  private let center: UNUserNotificationCenter

  init(center: UNUserNotificationCenter = .current()) {
    self.center = center
    center.setNotificationCategories(Self.notificationCategories)
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
      content.title = snapshot.title
      content.subtitle = event.summary
      content.body = notificationBody(for: snapshot)
      content.sound = .default
      content.categoryIdentifier = snapshot.rsvpURL == nil
        ? Self.meetupOnlyCategoryIdentifier
        : Self.meetupAndRSVPCategoryIdentifier
      content.userInfo = notificationUserInfo(for: snapshot)

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

  private func notificationBody(for snapshot: MeetupSnapshot) -> String {
    let when = snapshot.startsAt?.formatted(date: .abbreviated, time: .shortened) ?? "Date not confirmed yet"
    let whereLine = snapshot.locationDescription ?? "Location not confirmed yet"

    var lines = [when, whereLine]
    if let rsvpURL = snapshot.rsvpURL {
      lines.append("RSVP: \(displayURL(rsvpURL))")
    } else {
      lines.append("Meetup: \(displayURL(snapshot.meetupURL))")
    }

    return lines.joined(separator: "\n")
  }

  private func notificationUserInfo(for snapshot: MeetupSnapshot) -> [String: String] {
    var userInfo = ["meetupURL": snapshot.meetupURL.absoluteString]
    if let rsvpURL = snapshot.rsvpURL {
      userInfo["rsvpURL"] = rsvpURL.absoluteString
    }
    return userInfo
  }

  private func displayURL(_ url: URL) -> String {
    let host = url.host() ?? url.host ?? "coders.mu"
    let path = url.path.isEmpty ? "" : url.path
    return host + path
  }

  private static var notificationCategories: Set<UNNotificationCategory> {
    let openMeetupAction = UNNotificationAction(
      identifier: openMeetupActionIdentifier,
      title: "Open Meetup"
    )
    let openRSVPAction = UNNotificationAction(
      identifier: openRSVPActionIdentifier,
      title: "Open RSVP"
    )

    return [
      UNNotificationCategory(
        identifier: meetupOnlyCategoryIdentifier,
        actions: [openMeetupAction],
        intentIdentifiers: [],
        options: []
      ),
      UNNotificationCategory(
        identifier: meetupAndRSVPCategoryIdentifier,
        actions: [openMeetupAction, openRSVPAction],
        intentIdentifiers: [],
        options: []
      )
    ]
  }
}
