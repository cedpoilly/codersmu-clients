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
  var startsAt: Date?
  var endsAt: Date?
  var venueName: String?
  var venueAddress: String?
  var meetupURL: URL
  var rsvpURL: URL?
  var seatsRemaining: Int?
  var status: MeetupStatus
  var lastSyncedAt: Date

  var id: String {
    slug
  }

  var locationDescription: String? {
    let components = [venueName?.trimmedNilIfEmpty, venueAddress?.trimmedNilIfEmpty].compactMap { $0 }
    return components.isEmpty ? nil : components.joined(separator: ", ")
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
      URLQueryItem(name: "details", value: description?.trimmedNilIfEmpty),
      URLQueryItem(name: "location", value: locationDescription),
      URLQueryItem(name: "dates", value: "\(calendarTimestamp(for: startsAt))/\(calendarTimestamp(for: endDate))")
    ]
    return components?.url
  }
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
