import AppKit
import UserNotifications

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
  @MainActor
  static var onDidFinishLaunching: (@MainActor () -> Void)?

  func applicationDidFinishLaunching(_ notification: Notification) {
    UNUserNotificationCenter.current().delegate = self
    Task { @MainActor in
      AppDelegate.onDidFinishLaunching?()
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .sound]
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    guard let rawURL = response.notification.request.content.userInfo["meetupURL"] as? String,
          let url = URL(string: rawURL),
          url.scheme?.lowercased() == "https"
    else {
      return
    }

    NSWorkspace.shared.open(url)
  }
}
