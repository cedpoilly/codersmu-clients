import Foundation

@MainActor
protocol MeetupSource {
  func fetchNextMeetup() async throws -> MeetupSnapshot?
}

struct DeveloperSimulationScenario {
  var previousSnapshot: MeetupSnapshot?
  var latestSnapshot: MeetupSnapshot?
}

enum DeveloperInjectedEvent: String, Codable, CaseIterable, Identifiable {
  case nextMeetupCreated
  case dateChanged
  case locationChanged
  case descriptionChanged
  case agendaChanged
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
    case .descriptionChanged:
      return "Simulate Description Change"
    case .agendaChanged:
      return "Simulate Agenda Change"
    case .seatThresholdReached:
      return "Simulate 5 Seats Left"
    case .meetupPostponed:
      return "Simulate Postponed Meetup"
    }
  }

  func scenario(from snapshot: MeetupSnapshot?) -> DeveloperSimulationScenario? {
    switch self {
    case .nextMeetupCreated:
      var latestSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      let newStart = Calendar.current.date(byAdding: .day, value: 28, to: Date()) ?? Date().addingTimeInterval(28 * 24 * 60 * 60)
      let newEnd = Calendar.current.date(byAdding: .hour, value: 4, to: newStart) ?? newStart.addingTimeInterval(4 * 60 * 60)
      latestSnapshot.slug = "dev-\(Int(Date().timeIntervalSince1970))"
      latestSnapshot.title = "Developer Test Meetup"
      latestSnapshot.description = "Synthetic meetup used to exercise the notification pipeline."
      latestSnapshot.startsAt = newStart
      latestSnapshot.endsAt = newEnd
      latestSnapshot.venueName = "Dev Venue"
      latestSnapshot.venueAddress = "Developer Override, Ebene"
      latestSnapshot.meetupURL = URL(string: "https://coders.mu/meetup/\(latestSnapshot.slug)")!
      latestSnapshot.rsvpURL = latestSnapshot.meetupURL
      latestSnapshot.seatsRemaining = 42
      latestSnapshot.status = .upcoming
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: snapshot, latestSnapshot: latestSnapshot)
    case .dateChanged:
      let previousSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      var latestSnapshot = previousSnapshot
      let shiftedStart = Calendar.current.date(byAdding: .day, value: 1, to: previousSnapshot.startsAt ?? Date()) ?? Date().addingTimeInterval(24 * 60 * 60)
      latestSnapshot.startsAt = shiftedStart
      latestSnapshot.endsAt = Calendar.current.date(byAdding: .hour, value: 4, to: shiftedStart) ?? shiftedStart.addingTimeInterval(4 * 60 * 60)
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: previousSnapshot, latestSnapshot: latestSnapshot)
    case .locationChanged:
      let previousSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      var latestSnapshot = previousSnapshot
      let marker = UUID().uuidString.lowercased()
      latestSnapshot.venueName = "Developer Test Location \(marker.prefix(8))"
      latestSnapshot.venueAddress = "Override Tower \(marker.suffix(6)), Ebene"
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: previousSnapshot, latestSnapshot: latestSnapshot)
    case .descriptionChanged:
      let previousSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      var latestSnapshot = previousSnapshot
      let marker = UUID().uuidString.lowercased()
      latestSnapshot.description = "Updated meetup description \(marker.prefix(8))."
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: previousSnapshot, latestSnapshot: latestSnapshot)
    case .agendaChanged:
      let previousSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      var latestSnapshot = previousSnapshot
      let marker = UUID().uuidString.lowercased()
      latestSnapshot.agendaSummary = "Opening keynote \(marker.prefix(6)) | Lightning talks"
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: previousSnapshot, latestSnapshot: latestSnapshot)
    case .seatThresholdReached:
      var previousSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      var latestSnapshot = previousSnapshot
      previousSnapshot.seatsRemaining = 42
      latestSnapshot.seatsRemaining = 5
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: previousSnapshot, latestSnapshot: latestSnapshot)
    case .meetupPostponed:
      var previousSnapshot = snapshot ?? DeveloperInjectedEvent.makeSyntheticMeetup()
      var latestSnapshot = previousSnapshot
      previousSnapshot.status = .upcoming
      latestSnapshot.status = .postponed
      latestSnapshot.lastSyncedAt = Date()
      return DeveloperSimulationScenario(previousSnapshot: previousSnapshot, latestSnapshot: latestSnapshot)
    }
  }

  func applying(to snapshot: MeetupSnapshot?) -> MeetupSnapshot? {
    scenario(from: snapshot)?.latestSnapshot
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
      agendaSummary: "Intro to SwiftUI | Shipping the Coders.mu clients",
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
