import AppKit
import UserNotifications

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
  @MainActor
  static var onDidFinishLaunching: (@MainActor () -> Void)?

  func applicationDidFinishLaunching(_ notification: Notification) {
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
    let userInfo = response.notification.request.content.userInfo

    let targetKey: String
    switch response.actionIdentifier {
    case UserNotificationService.openRSVPActionIdentifier:
      targetKey = "rsvpURL"
    default:
      targetKey = "meetupURL"
    }

    guard let rawURL = userInfo[targetKey] as? String ?? userInfo["meetupURL"] as? String,
          let url = URL(string: rawURL)
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
      return
    }

    NSApplication.shared.applicationIconImage = icon
  }
}
