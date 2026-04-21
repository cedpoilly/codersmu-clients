import SwiftUI

struct NextMeetupSummaryView: View {
  let snapshot: MeetupSnapshot?

  var body: some View {
    if let snapshot {
      VStack(alignment: .leading, spacing: 10) {
        Text(snapshot.title)
          .font(.title3.weight(.semibold))

        if let startsAt = snapshot.startsAt {
          Text(startsAt.formatted(date: .complete, time: .shortened))
            .font(.subheadline)
        } else {
          Text("Date not confirmed yet")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Text(snapshot.locationDescription ?? "Location not confirmed yet")
          .font(.subheadline)
          .foregroundStyle(.secondary)

        if let description = snapshot.description?.trimmingCharacters(in: .whitespacesAndNewlines),
           !description.isEmpty {
          Text(description)
            .font(.callout)
            .foregroundStyle(.secondary)
            .lineLimit(4)
        }

        if let seatsRemaining = snapshot.seatsRemaining {
          Label("\(seatsRemaining) seats remaining", systemImage: "person.3")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    } else {
      VStack(alignment: .leading, spacing: 8) {
        Text("No upcoming meetup published yet.")
          .font(.headline)
        Text("The app is ready, but it doesn't have a next meetup to watch yet.")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
  }
}
