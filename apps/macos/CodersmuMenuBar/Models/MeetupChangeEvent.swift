import Foundation

enum MeetupChangeKind: String, Codable, Hashable {
  case nextMeetupCreated
  case dateConfirmed
  case dateChanged
  case locationConfirmed
  case locationChanged
  case rsvpOpened
  case seatThresholdReached
  case meetupCanceledOrPostponed
  case slidesPublished
  case recordingPublished
}

struct MeetupChangeEvent: Codable, Hashable, Identifiable {
  var kind: MeetupChangeKind
  var seatThreshold: Int?
  var summary: String
  var detectedAt: Date
  var meetupSlug: String

  var id: String {
    fingerprint
  }

  var fingerprint: String {
    if let seatThreshold {
      return "\(meetupSlug):\(kind.rawValue):\(seatThreshold)"
    }

    return "\(meetupSlug):\(kind.rawValue)"
  }
}
