import Foundation

enum MeetupStatus: String, Codable {
  case upcoming
  case postponed
  case canceled

  var label: String {
    switch self {
    case .upcoming:
      return "Upcoming"
    case .postponed:
      return "Postponed"
    case .canceled:
      return "Canceled"
    }
  }
}

struct MeetupSnapshot: Codable, Equatable, Identifiable {
  var slug: String
  var title: String
  var description: String?
  var agendaSummary: String?
  var agendaItems: [MeetupAgendaItem]
  var startsAt: Date?
  var endsAt: Date?
  var venueName: String?
  var venueAddress: String?
  var meetupURL: URL
  var rsvpURL: URL?
  var seatsRemaining: Int?
  var status: MeetupStatus
  var lastSyncedAt: Date

  init(
    slug: String,
    title: String,
    description: String?,
    agendaSummary: String?,
    agendaItems: [MeetupAgendaItem] = [],
    startsAt: Date?,
    endsAt: Date?,
    venueName: String?,
    venueAddress: String?,
    meetupURL: URL,
    rsvpURL: URL?,
    seatsRemaining: Int?,
    status: MeetupStatus,
    lastSyncedAt: Date
  ) {
    self.slug = slug
    self.title = title
    self.description = description
    self.agendaSummary = agendaSummary
    self.agendaItems = agendaItems
    self.startsAt = startsAt
    self.endsAt = endsAt
    self.venueName = venueName
    self.venueAddress = venueAddress
    self.meetupURL = meetupURL
    self.rsvpURL = rsvpURL
    self.seatsRemaining = seatsRemaining
    self.status = status
    self.lastSyncedAt = lastSyncedAt
  }

  enum CodingKeys: String, CodingKey {
    case slug
    case title
    case description
    case agendaSummary
    case agendaItems
    case startsAt
    case endsAt
    case venueName
    case venueAddress
    case meetupURL
    case rsvpURL
    case seatsRemaining
    case status
    case lastSyncedAt
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    self.slug = try container.decode(String.self, forKey: .slug)
    self.title = try container.decode(String.self, forKey: .title)
    self.description = try container.decodeIfPresent(String.self, forKey: .description)
    self.agendaSummary = try container.decodeIfPresent(String.self, forKey: .agendaSummary)
    self.agendaItems = try container.decodeIfPresent([MeetupAgendaItem].self, forKey: .agendaItems) ?? []
    self.startsAt = try container.decodeIfPresent(Date.self, forKey: .startsAt)
    self.endsAt = try container.decodeIfPresent(Date.self, forKey: .endsAt)
    self.venueName = try container.decodeIfPresent(String.self, forKey: .venueName)
    self.venueAddress = try container.decodeIfPresent(String.self, forKey: .venueAddress)
    self.meetupURL = try container.decode(URL.self, forKey: .meetupURL)
    self.rsvpURL = try container.decodeIfPresent(URL.self, forKey: .rsvpURL)
    self.seatsRemaining = try container.decodeIfPresent(Int.self, forKey: .seatsRemaining)
    self.status = try container.decode(MeetupStatus.self, forKey: .status)
    self.lastSyncedAt = try container.decode(Date.self, forKey: .lastSyncedAt)
  }

  var id: String {
    slug
  }

  var changeIdentity: String {
    meetupURL.absoluteString.lowercased()
  }

  var locationDescription: String? {
    let components = [venueName?.trimmedNilIfEmpty, venueAddress?.trimmedNilIfEmpty].compactMap { $0 }
    return components.isEmpty ? nil : components.joined(separator: ", ")
  }

  var detailsText: String? {
    description?.trimmedNilIfEmpty ?? agendaSummary?.trimmedNilIfEmpty
  }

  var googleCalendarURL: URL? {
    guard let startsAt else {
      return nil
    }

    let endDate = endsAt ?? startsAt.addingTimeInterval(2 * 60 * 60)
    var components = URLComponents(string: "https://calendar.google.com/calendar/render")
    components?.queryItems = [
      URLQueryItem(name: "action", value: "TEMPLATE"),
      URLQueryItem(name: "text", value: title),
      URLQueryItem(name: "details", value: detailsText),
      URLQueryItem(name: "location", value: locationDescription),
      URLQueryItem(name: "dates", value: "\(calendarTimestamp(for: startsAt))/\(calendarTimestamp(for: endDate))")
    ]
    return components?.url
  }
}

struct MeetupAgendaItem: Codable, Equatable, Identifiable {
  var id: String
  var title: String
  var description: String?
  var durationMinutes: Int?
  var speakers: [String]
}

private extension String {
  var trimmedNilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}

private func calendarTimestamp(for date: Date) -> String {
  let formatter = DateFormatter()
  formatter.calendar = Calendar(identifier: .gregorian)
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  formatter.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
  return formatter.string(from: date)
}
