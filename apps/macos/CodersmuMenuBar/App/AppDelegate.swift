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
    // Pull the icon through the asset-catalog lookup rather than probing for a
    // hardcoded AppIcon.icns in Resources. actool usually emits that file, but
    // the asset-catalog entry is the contract — NSImage(named:) resolves it
    // whichever compiled representation Xcode chose.
    guard let icon = NSImage(named: "AppIcon") else {
      AppLog.notifications.error("Failed to load the AppIcon asset from the asset catalog.")
      return
    }

    NSApplication.shared.applicationIconImage = icon
  }
}
