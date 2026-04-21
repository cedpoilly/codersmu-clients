import Foundation

enum NotificationAuthorizationState: String {
  case notDetermined
  case denied
  case authorized
  case provisional
  case ephemeral
  case unsupported

  var label: String {
    switch self {
    case .notDetermined:
      return "Not requested"
    case .denied:
      return "Denied"
    case .authorized:
      return "Authorized"
    case .provisional:
      return "Provisional"
    case .ephemeral:
      return "Ephemeral"
    case .unsupported:
      return "Unavailable"
    }
  }
}

struct NotificationDebugState {
  var authorizationState: NotificationAuthorizationState
  var alertsEnabled: Bool
  var soundsEnabled: Bool
  var notificationCenterEnabled: Bool

  static let unavailable = NotificationDebugState(
    authorizationState: .unsupported,
    alertsEnabled: false,
    soundsEnabled: false,
    notificationCenterEnabled: false
  )

  var summary: String {
    let alerts = alertsEnabled ? "alerts on" : "alerts off"
    let sounds = soundsEnabled ? "sounds on" : "sounds off"
    let center = notificationCenterEnabled ? "center on" : "center off"
    return "\(authorizationState.label) (\(alerts), \(sounds), \(center))"
  }
}

enum NotificationDeliveryResult {
  case scheduled(String)
  case suppressed(String)
  case failed(String)

  var message: String {
    switch self {
    case .scheduled(let message), .suppressed(let message), .failed(let message):
      return message
    }
  }

  var kind: Kind {
    switch self {
    case .scheduled:
      return .scheduled
    case .suppressed:
      return .suppressed
    case .failed:
      return .failed
    }
  }

  enum Kind {
    case scheduled
    case suppressed
    case failed
  }
}

@MainActor
protocol NotificationService {
  func requestAuthorization() async
  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async -> [NotificationDeliveryResult]
  func notificationDebugState() async -> NotificationDebugState
  func sendTestNotification(preferences: AppPreferences) async -> NotificationDeliveryResult
}

extension NotificationService {
  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async -> [NotificationDeliveryResult] {
    []
  }

  func notificationDebugState() async -> NotificationDebugState {
    .unavailable
  }

  func sendTestNotification(preferences: AppPreferences) async -> NotificationDeliveryResult {
    .failed("Notification debugging is unavailable in this environment.")
  }
}
