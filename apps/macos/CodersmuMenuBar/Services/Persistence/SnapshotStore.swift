import Foundation

struct PersistedAppState: Codable {
  var snapshot: MeetupSnapshot?
  var deliveredFingerprints: Set<String>
  var lastRefreshAt: Date?

  static let empty = PersistedAppState(
    snapshot: nil,
    deliveredFingerprints: [],
    lastRefreshAt: nil
  )
}

protocol SnapshotStore {
  func loadState() throws -> PersistedAppState
  func saveState(_ state: PersistedAppState) throws
}
