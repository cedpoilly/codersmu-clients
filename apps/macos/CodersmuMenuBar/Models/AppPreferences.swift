import Foundation

struct QuietHoursWindow: Codable, Equatable {
  var startHour: Int
  var endHour: Int

  static let overnightDefault = QuietHoursWindow(startHour: 22, endHour: 8)

  func contains(_ date: Date, calendar: Calendar = .current) -> Bool {
    let hour = calendar.component(.hour, from: date)

    if startHour == endHour {
      return false
    }

    if startHour < endHour {
      return hour >= startHour && hour < endHour
    }

    return hour >= startHour || hour < endHour
  }
}

struct AppPreferences: Codable, Equatable {
  var notificationsPaused: Bool
  var quietHoursEnabled: Bool
  var quietHours: QuietHoursWindow
  var snoozedUntil: Date?
  var launchAtLoginEnabled: Bool

  static let `default` = AppPreferences(
    notificationsPaused: false,
    quietHoursEnabled: true,
    quietHours: .overnightDefault,
    snoozedUntil: nil,
    launchAtLoginEnabled: false
  )

  var isSnoozed: Bool {
    guard let snoozedUntil else {
      return false
    }

    return snoozedUntil > Date()
  }
}
