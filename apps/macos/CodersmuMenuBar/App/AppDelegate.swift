import AppKit
import UserNotifications

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
  @MainActor
  static var onDidFinishLaunching: (@MainActor () -> Void)?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApplication.shared.setActivationPolicy(.accessory)
    configureApplicationIcon()
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

  @MainActor
  private func configureApplicationIcon() {
    guard let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
          let icon = NSImage(contentsOf: iconURL)
    else {
      AppLog.notifications.error("Failed to load AppIcon.icns from the app bundle.")
      return
    }

    NSApplication.shared.applicationIconImage = icon
  }
}
