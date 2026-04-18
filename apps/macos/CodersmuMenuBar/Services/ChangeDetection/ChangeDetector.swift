import Foundation

struct ChangeDetector {
  private let seatThresholds = [25, 10, 5]

  func detectChanges(from previous: MeetupSnapshot?, to current: MeetupSnapshot) -> [MeetupChangeEvent] {
    let now = Date()

    guard let previous else {
      return [
        MeetupChangeEvent(
          kind: .nextMeetupCreated,
          seatThreshold: nil,
          dedupeKey: nil,
          summary: "A new upcoming meetup is available: \(current.title).",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      ]
    }

    guard previous.changeIdentity == current.changeIdentity else {
      return [
        MeetupChangeEvent(
          kind: .nextMeetupCreated,
          seatThreshold: nil,
          dedupeKey: nil,
          summary: "A new upcoming meetup replaced the previous one: \(current.title).",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      ]
    }

    var events: [MeetupChangeEvent] = []

    if previous.startsAt == nil, current.startsAt != nil {
      events.append(
        MeetupChangeEvent(
          kind: .dateConfirmed,
          seatThreshold: nil,
          dedupeKey: current.scheduleDedupeKey,
          summary: "The meetup date is now confirmed.",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    } else if previous.startsAt != current.startsAt || previous.endsAt != current.endsAt {
      events.append(
        MeetupChangeEvent(
          kind: .dateChanged,
          seatThreshold: nil,
          dedupeKey: current.scheduleDedupeKey,
          summary: "The meetup schedule changed.",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    }

    if previous.locationDescription == nil, current.locationDescription != nil {
      events.append(
        MeetupChangeEvent(
          kind: .locationConfirmed,
          seatThreshold: nil,
          dedupeKey: current.locationDedupeKey,
          summary: "The meetup location is now confirmed.",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    } else if previous.locationDescription != nil, current.locationDescription != nil, previous.locationDescription != current.locationDescription {
      events.append(
        MeetupChangeEvent(
          kind: .locationChanged,
          seatThreshold: nil,
          dedupeKey: current.locationDedupeKey,
          summary: "The meetup location changed.",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    }

    if previous.rsvpURL == nil, current.rsvpURL != nil {
      events.append(
        MeetupChangeEvent(
          kind: .rsvpOpened,
          seatThreshold: nil,
          dedupeKey: nil,
          summary: "RSVP is now open for the next meetup.",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    }

    if let seatThreshold = mostUrgentThresholdCrossed(from: previous.seatsRemaining, to: current.seatsRemaining) {
      events.append(
        MeetupChangeEvent(
          kind: .seatThresholdReached,
          seatThreshold: seatThreshold,
          dedupeKey: nil,
          summary: "Only \(seatThreshold) seats are left. RSVP soon.",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    }

    if previous.status != current.status, current.status != .upcoming {
      events.append(
        MeetupChangeEvent(
          kind: .meetupCanceledOrPostponed,
          seatThreshold: nil,
          dedupeKey: current.status.rawValue,
          summary: "The meetup was \(current.status == .postponed ? "postponed" : "canceled").",
          detectedAt: now,
          meetupSlug: current.changeIdentity
        )
      )
    }

    return events
  }

  private func mostUrgentThresholdCrossed(from oldValue: Int?, to newValue: Int?) -> Int? {
    guard let newValue else {
      return nil
    }

    let crossed = seatThresholds.filter { threshold in
      newValue <= threshold && (oldValue == nil || oldValue! > threshold)
    }

    return crossed.min()
  }
}

private extension MeetupSnapshot {
  var scheduleDedupeKey: String {
    let start = startsAt?.ISO8601Format() ?? "nil"
    let end = endsAt?.ISO8601Format() ?? "nil"
    return "\(start)|\(end)"
  }

  var locationDedupeKey: String {
    locationDescription?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "nil"
  }
}
