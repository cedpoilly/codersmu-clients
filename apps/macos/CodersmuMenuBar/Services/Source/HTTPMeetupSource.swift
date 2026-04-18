import Foundation

struct HTTPMeetupSource: MeetupSource {
  private let apiClient: CodersMuAPIClient

  init(apiClient: CodersMuAPIClient = CodersMuAPIClient()) {
    self.apiClient = apiClient
  }

  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    let response = try await apiClient.fetchNextMeetupResponse()

    guard let meetup = response.meetup else {
      return nil
    }

    return meetup.toSnapshot(lastSyncedAt: Date())
  }
}
