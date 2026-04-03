import Foundation

@MainActor
protocol NotificationService {
  func requestAuthorization() async
  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async
}
