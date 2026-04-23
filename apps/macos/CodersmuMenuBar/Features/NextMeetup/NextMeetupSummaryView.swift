import SwiftUI

struct NextMeetupSummaryView: View {
  let snapshot: MeetupSnapshot?
  let agendaItems: [MeetupAgendaItem]
  @Binding var isShowingAgenda: Bool

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
          .lineLimit(2)
          .fixedSize(horizontal: false, vertical: true)

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

        if !agendaItems.isEmpty {
          Button {
            isShowingAgenda.toggle()
          } label: {
            Label(isShowingAgenda ? "Hide Agenda" : "Show Agenda", systemImage: "list.bullet.rectangle")
          }
          .font(.caption)
          .buttonStyle(.link)

          if isShowingAgenda {
            VStack(alignment: .leading, spacing: 6) {
              Text("Agenda")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)

              ForEach(agendaItems) { item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                  HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(item.title)
                      .font(.caption.weight(.medium))
                      .foregroundStyle(.primary)

                    if let speakersLabel = item.speakersLabel {
                      Text(speakersLabel)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                  }
                  .fixedSize(horizontal: false, vertical: true)

                  Spacer(minLength: 8)

                  if let durationLabel = item.durationLabel {
                    Text(durationLabel)
                      .font(.caption2.weight(.semibold))
                      .foregroundStyle(.secondary)
                      .padding(.horizontal, 6)
                      .padding(.vertical, 2)
                      .background(.quaternary, in: Capsule())
                  }
                }
              }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
          }
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

private extension MeetupAgendaItem {
  var durationLabel: String? {
    guard let durationMinutes, durationMinutes > 0 else {
      return nil
    }

    return "\(durationMinutes) min"
  }

  var speakersLabel: String? {
    let names = speakers
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    guard !names.isEmpty else {
      return nil
    }

    return names.joined(separator: ", ")
  }
}
