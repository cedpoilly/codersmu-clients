import Foundation

enum SampleData {
  static var nextMeetup: MeetupSnapshot {
    return MeetupSnapshot(
      slug: "2026-05-23-the-may-meetup",
      title: "The May Meetup",
      description: nil,
      agendaSummary: nil,
      startsAt: ISO8601DateFormatter().date(from: "2026-05-23T06:00:00Z"),
      endsAt: ISO8601DateFormatter().date(from: "2026-05-23T10:00:00Z"),
      venueName: "Astek Mauritius",
      venueAddress: "One Exchange Square, 12th Floor, Tower A, Wall St, Ebene",
      meetupURL: URL(string: "https://coders.mu/meetup/8846d85b-363a-41a1-8249-6034e34efacb")!,
      rsvpURL: nil,
      seatsRemaining: nil,
      status: .upcoming,
      lastSyncedAt: Date()
    )
  }
}
