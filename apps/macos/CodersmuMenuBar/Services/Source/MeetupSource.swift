import Foundation

@MainActor
protocol MeetupSource {
  func fetchNextMeetup() async throws -> MeetupSnapshot?
}
