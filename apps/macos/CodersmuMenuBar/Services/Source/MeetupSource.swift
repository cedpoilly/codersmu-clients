import Foundation

@MainActor
protocol MeetupSource {
  func fetchNextMeetup() async throws -> MeetupSnapshot?
}

enum DeveloperInjectedEvent: String, Codable, CaseIterable, Identifiable {
  case nextMeetupCreated
  case dateChanged
  case locationChanged
  case seatThresholdReached
  case meetupPostponed

  var id: String {
    rawValue
  }

  var buttonTitle: String {
    switch self {
    case .nextMeetupCreated:
      return "Simulate New Meetup"
    case .dateChanged:
      return "Simulate Date Change"
    case .locationChanged:
      return "Simulate Location Change"
    case .seatThresholdReached:
      return "Simulate 5 Seats Left"
    case .meetupPostponed:
      return "Simulate Postponed Meetup"
    }
  }

  func applying(to snapshot: MeetupSnapshot?) -> MeetupSnapshot? {
    switch self {
    case .nextMeetupCreated:
      var snapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      let newStart = Calendar.current.date(byAdding: .day, value: 28, to: Date()) ?? Date().addingTimeInterval(28 * 24 * 60 * 60)
      let newEnd = Calendar.current.date(byAdding: .hour, value: 4, to: newStart) ?? newStart.addingTimeInterval(4 * 60 * 60)
      snapshot.slug = "dev-\(Int(Date().timeIntervalSince1970))"
      snapshot.title = "Developer Test Meetup"
      snapshot.description = "Synthetic meetup used to exercise the notification pipeline."
      snapshot.startsAt = newStart
      snapshot.endsAt = newEnd
      snapshot.venueName = "Dev Venue"
      snapshot.venueAddress = "Developer Override, Ebene"
      snapshot.meetupURL = URL(string: "https://coders.mu/meetup/\(snapshot.slug)")!
      snapshot.rsvpURL = snapshot.meetupURL
      snapshot.seatsRemaining = 42
      snapshot.status = .upcoming
      snapshot.lastSyncedAt = Date()
      return snapshot
    case .dateChanged:
      guard var snapshot else {
        return nil
      }
      let shiftedStart = Calendar.current.date(byAdding: .day, value: 1, to: snapshot.startsAt ?? Date()) ?? Date().addingTimeInterval(24 * 60 * 60)
      snapshot.startsAt = shiftedStart
      snapshot.endsAt = Calendar.current.date(byAdding: .hour, value: 4, to: shiftedStart) ?? shiftedStart.addingTimeInterval(4 * 60 * 60)
      snapshot.lastSyncedAt = Date()
      return snapshot
    case .locationChanged:
      guard var snapshot else {
        return nil
      }
      snapshot.venueName = "Developer Test Location"
      snapshot.venueAddress = "Floor 99, Override Tower, Ebene"
      snapshot.lastSyncedAt = Date()
      return snapshot
    case .seatThresholdReached:
      guard var snapshot else {
        return nil
      }
      snapshot.seatsRemaining = 5
      snapshot.lastSyncedAt = Date()
      return snapshot
    case .meetupPostponed:
      guard var snapshot else {
        return nil
      }
      snapshot.status = .postponed
      snapshot.lastSyncedAt = Date()
      return snapshot
    }
  }

  private static func makeSyntheticMeetup(now: Date = Date()) -> MeetupSnapshot {
    let start = Calendar.current.date(byAdding: .day, value: 21, to: now)
      ?? now.addingTimeInterval(21 * 24 * 60 * 60)
    let end = Calendar.current.date(byAdding: .hour, value: 4, to: start)
      ?? start.addingTimeInterval(4 * 60 * 60)

    return MeetupSnapshot(
      slug: "dev-baseline-\(Int(now.timeIntervalSince1970))",
      title: "Developer Test Meetup",
      description: "Synthetic meetup used to exercise the notification pipeline.",
      startsAt: start,
      endsAt: end,
      venueName: "Dev Venue",
      venueAddress: "Developer Override, Ebene",
      meetupURL: URL(string: "https://coders.mu/meetup/dev-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/dev-baseline")!,
      seatsRemaining: 42,
      status: .upcoming,
      lastSyncedAt: now
    )
  }
}
