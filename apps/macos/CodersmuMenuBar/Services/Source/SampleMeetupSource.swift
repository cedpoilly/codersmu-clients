import Foundation

struct SampleMeetupSource: MeetupSource {
  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    SampleData.nextMeetup
  }
}
