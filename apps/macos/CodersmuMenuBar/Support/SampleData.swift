import Foundation

enum SampleData {
  static var nextMeetup: MeetupSnapshot {
    let calendar = Calendar.current
    let start = calendar.date(byAdding: .day, value: 20, to: Date())
      ?? Date().addingTimeInterval(20 * 24 * 60 * 60)
    let end = calendar.date(byAdding: .hour, value: 4, to: start)
      ?? start.addingTimeInterval(4 * 60 * 60)

    return MeetupSnapshot(
      slug: "2026-05-codersmu-meetup",
      title: "The May Meetup",
      description: "Initial local scaffold data for the Coders.mu macOS app. Replace this source with the real meetup adapter next.",
      startsAt: start,
      endsAt: end,
      venueName: "Spoon Consulting Offices",
      venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
      meetupURL: URL(string: "https://www.coders.mu/meetups/2026-05-codersmu-meetup")!,
      rsvpURL: URL(string: "https://www.coders.mu/meetups/2026-05-codersmu-meetup#rsvp")!,
      seatsRemaining: 24,
      status: .upcoming,
      lastSyncedAt: Date()
    )
  }
}
