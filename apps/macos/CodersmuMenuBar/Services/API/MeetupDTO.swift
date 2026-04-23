import Foundation

private let mauritiusUTCOffset = "+04:00"
private let defaultDurationHours = 4
private let meetupDetailURLPrefix = "https://coders.mu/meetup/"

struct CodersMuIndexPayload: Decodable {
  struct Props: Decodable {
    let meetups: [CodersMuMeetupDTO]
  }

  let props: Props
}

struct CodersMuDetailPayload: Decodable {
  struct Props: Decodable {
    let meetup: CodersMuMeetupDTO
    let rsvpCount: Int?
  }

  let props: Props
}

struct CodersMuSpeakerDTO: Decodable {
  let name: String
  let title: String?
  let githubUsername: String?
  let avatarUrl: String?
  let featured: CodersMuBoolish?
}

struct CodersMuSponsorDTO: Decodable {
  let name: String
  let website: String?
  let sponsorTypes: [String]?
}

enum CodersMuBoolish: Decodable {
  case bool(Bool)
  case int(Int)
  case string(String)

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()

    if let value = try? container.decode(Bool.self) {
      self = .bool(value)
      return
    }

    if let value = try? container.decode(Int.self) {
      self = .int(value)
      return
    }

    if let value = try? container.decode(String.self) {
      self = .string(value)
      return
    }

    throw DecodingError.typeMismatch(
      CodersMuBoolish.self,
      DecodingError.Context(
        codingPath: decoder.codingPath,
        debugDescription: "Expected a bool-like value."
      )
    )
  }

  var value: Bool {
    switch self {
    case let .bool(boolValue):
      return boolValue
    case let .int(intValue):
      return intValue != 0
    case let .string(stringValue):
      let normalized = stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      return normalized == "1" || normalized == "true" || normalized == "yes"
    }
  }
}

struct CodersMuSessionDTO: Decodable {
  let id: String?
  let title: String
  let description: String?
  let durationMinutes: Int?
  let order: Int?
  let speakers: [CodersMuSpeakerDTO]?
}

enum MeetupContractStatusDTO: String, Decodable {
  case scheduled
  case ongoing
  case completed
  case postponed
  case canceled
}

struct MeetupSpeakerDTO: Decodable {
  let name: String
  let title: String?
  let githubUsername: String?
  let avatarUrl: String?
  let featured: Bool?
}

struct MeetupSessionDTO: Decodable {
  let id: String?
  let title: String
  let description: String?
  let durationMinutes: Int?
  let speakers: [MeetupSpeakerDTO]
}

struct MeetupSponsorDTO: Decodable {
  let name: String
  let website: String?
  let sponsorTypes: [String]
}

struct MeetupLocationDTO: Decodable {
  let name: String
  let address: String?
  let city: String?
}

struct MeetupLinksDTO: Decodable {
  let meetup: String?
  let recording: String?
  let slides: String?
  let map: String?
  let parking: String?
  let rsvp: String?
}

struct MeetupDTO: Decodable {
  let id: String
  let slug: String
  let title: String
  let summary: String
  let descriptionText: String?
  let agendaSummary: String?
  let startsAt: String
  let endsAt: String
  let timezone: String
  let status: MeetupContractStatusDTO
  let location: MeetupLocationDTO
  let speakers: [MeetupSpeakerDTO]
  let sessions: [MeetupSessionDTO]
  let sponsors: [MeetupSponsorDTO]
  let attendeeCount: Int?
  let seatsAvailable: Int?
  let capacityTotal: Int?
  let rsvpCount: Int?
  let seatsRemaining: Int?
  let acceptingRsvp: Bool?
  let links: MeetupLinksDTO

  func toSnapshot(lastSyncedAt: Date) throws -> MeetupSnapshot {
    guard let meetupURL = normalizedHTTPSURL(links.meetup) else {
      throw APIError.invalidPayload("Coders.mu returned an unusable meetup URL for \(id).")
    }

    let normalizedAgendaSummary = normalizedAgendaSummaryFromSessions
    let normalizedDescription = normalizedDescriptionText(fallingBackFrom: normalizedAgendaSummary)

    return MeetupSnapshot(
      slug: slug,
      title: title,
      description: normalizedDescription,
      agendaSummary: normalizedAgendaSummary,
      agendaItems: normalizedAgendaItems,
      startsAt: parsedDate(startsAt),
      endsAt: parsedDate(endsAt),
      venueName: location.name.normalizedLocationValue,
      venueAddress: [location.address?.normalizedLocationValue, location.city?.normalizedLocationValue]
        .compactMap { $0 }
        .joined(separator: ", ")
        .trimmedNilIfEmpty,
      meetupURL: meetupURL,
      rsvpURL: normalizedRsvpURL(meetupURL: meetupURL),
      seatsRemaining: seatsRemaining ?? seatsAvailable,
      status: snapshotStatus,
      lastSyncedAt: lastSyncedAt
    )
  }

  private func normalizedRsvpURL(meetupURL: URL) -> URL? {
    if let url = normalizedHTTPSURL(links.rsvp) {
      return url
    }

    return (acceptingRsvp ?? false) ? meetupURL : nil
  }

  private var snapshotStatus: MeetupStatus {
    switch status {
    case .postponed:
      return .postponed
    case .canceled:
      return .canceled
    default:
      return .upcoming
    }
  }

  private var normalizedAgendaSummaryFromSessions: String? {
    if let agendaSummary = agendaSummary?.normalizedSummary {
      return agendaSummary
    }

    let sessionTitles = sessions
      .map(\.title)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    guard !sessionTitles.isEmpty else {
      return nil
    }

    return sessionTitles.joined(separator: " | ")
  }

  private var normalizedAgendaItems: [MeetupAgendaItem] {
    sessions.enumerated().compactMap { index, session in
      guard let title = session.title.normalizedSummary else {
        return nil
      }

      let speakers = session.speakers
        .compactMap { $0.name.trimmedNilIfEmpty }

      return MeetupAgendaItem(
        id: session.id?.trimmedNilIfEmpty ?? "\(index)-\(slugify(title))",
        title: title,
        description: session.description?.normalizedSummary,
        durationMinutes: session.durationMinutes,
        speakers: speakers
      )
    }
  }

  private func normalizedDescriptionText(fallingBackFrom normalizedAgendaSummary: String?) -> String? {
    if let descriptionText = descriptionText?.normalizedSummary {
      return descriptionText
    }

    let normalizedSummary = summary.normalizedSummary
    guard normalizedSummary != normalizedAgendaSummary else {
      return nil
    }

    return normalizedSummary
  }
}

struct MeetupResponseDTO: Decodable {
  let meetup: MeetupDTO
}

struct NextMeetupResponseDTO: Decodable {
  let meetup: MeetupDTO?
}

struct MeetupListResponseDTO: Decodable {
  let meetups: [MeetupDTO]
}

struct HostedNextMeetupResponseDTO: Decodable {
  let meetup: HostedMeetupDTO?
}

struct HostedMeetupSpeakerDTO: Decodable {
  let id: String?
  let name: String
  let githubUsername: String?
  let avatarUrl: String?
  let featured: Int?
}

struct HostedMeetupSessionDTO: Decodable {
  let id: String?
  let title: String
  let description: String?
  let durationMinutes: Int?
  let order: Int?
  let speakers: [HostedMeetupSpeakerDTO]
}

struct HostedMeetupSponsorDTO: Decodable {
  let id: String?
  let name: String
  let website: String?
  let logoUrl: String?
  let sponsorTypes: [String]?
  let logoBg: String?
  let status: String?
}

struct HostedMeetupDTO: Decodable {
  let id: String
  let slug: String?
  let title: String
  let description: String?
  let date: String?
  let startTime: String?
  let endTime: String?
  let venue: String?
  let location: String?
  let status: String
  let sessions: [HostedMeetupSessionDTO]
  let sponsors: [HostedMeetupSponsorDTO]
  let attendeeCount: Int?
  let seatsAvailable: Int?
  let capacityTotal: Int?
  let rsvpCount: Int?
  let seatsRemaining: Int?
  let acceptingRsvp: CodersMuBoolish?
  let rsvpClosingDate: String?
  let rsvpLink: String?
  let mapUrl: String?
  let parkingLocation: String?

  func toContract() throws -> MeetupDTO {
    guard let date else {
      throw APIError.invalidPayload("Hosted meetup \(id) does not have a date.")
    }

    let cleanTitle = stripHTML(title) ?? title
    let venueName = normalizeLocationValue(stripHTML(venue) ?? "TBA")
    let venueAddress = normalizeLocationValue(stripHTML(location))
    let meetupURL = "\(meetupDetailURLPrefix)\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)"
    let normalizedSessions = sessions.map { session in
      MeetupSessionDTO(
        id: session.id,
        title: stripHTML(session.title) ?? session.title,
        description: stripHTML(session.description),
        durationMinutes: session.durationMinutes,
        speakers: session.speakers.map { speaker in
          MeetupSpeakerDTO(
            name: speaker.name,
            title: nil,
            githubUsername: speaker.githubUsername,
            avatarUrl: speaker.avatarUrl,
            featured: speaker.featured.map { $0 != 0 }
          )
        }
      )
    }
    let normalizedDescription = normalizedDescription
    let normalizedAgendaSummary = normalizedAgendaSummary(normalizedSessions: normalizedSessions)

    return MeetupDTO(
      id: id,
      slug: slug?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        ? slug!.trimmingCharacters(in: .whitespacesAndNewlines)
        : "\(date.prefix(10))-\(slugify(cleanTitle))",
      title: cleanTitle,
      summary: normalizedDescription ?? normalizedAgendaSummary ?? "No meetup description published yet.",
      descriptionText: normalizedDescription,
      agendaSummary: normalizedAgendaSummary,
      startsAt: startsAt?.iso8601String ?? buildUTCDate(date: date, time: normalizeTime(startTime))?.iso8601String ?? "",
      endsAt: endsAt?.iso8601String ?? buildUTCDate(date: date, time: normalizeTime(startTime))?.addingTimeInterval(Double(defaultDurationHours * 60 * 60)).iso8601String ?? "",
      timezone: "Indian/Mauritius",
      status: normalizedContractStatus,
      location: MeetupLocationDTO(
        name: venueName ?? "TBA",
        address: venueAddress,
        city: nil
      ),
      speakers: dedupeSpeakers(from: normalizedSessions),
      sessions: normalizedSessions,
      sponsors: sponsors.map { sponsor in
        MeetupSponsorDTO(
          name: sponsor.name,
          website: sponsor.website,
          sponsorTypes: sponsor.sponsorTypes ?? []
        )
      },
      attendeeCount: attendeeCount,
      seatsAvailable: seatsAvailable,
      capacityTotal: capacityTotal ?? seatsAvailable,
      rsvpCount: rsvpCount,
      seatsRemaining: seatsRemaining ?? HostedMeetupDTO.computeSeatsRemaining(capacityTotal: capacityTotal ?? seatsAvailable, rsvpCount: rsvpCount),
      acceptingRsvp: acceptingRsvp?.value,
      links: MeetupLinksDTO(
        meetup: meetupURL,
        recording: nil,
        slides: nil,
        map: normalizedHTTPSURLString(mapUrl),
        parking: normalizedHTTPSURLString(parkingLocation),
        rsvp: normalizedRsvpLink(meetupURL: meetupURL)
      )
    )
  }

  private var startsAt: Date? {
    guard let date else {
      return nil
    }

    return buildUTCDate(date: date, time: normalizeTime(startTime))
  }

  private var endsAt: Date? {
    guard let date, let start = startsAt else {
      return nil
    }

    guard let endTime else {
      return start.addingTimeInterval(Double(defaultDurationHours * 60 * 60))
    }

    let startMinutes = toMinutes(normalizeTime(startTime))
    var endMinutes = toMinutes(normalizeTime(endTime))

    if endMinutes <= startMinutes {
      endMinutes += 24 * 60
    }

    let normalizedHours = (endMinutes / 60) % 24
    let normalizedMinutes = endMinutes % 60
    let dayOffset = endMinutes / (24 * 60)
    let localDate = addDays(to: date, days: dayOffset)

    return buildUTCDate(
      date: localDate,
      time: String(format: "%02d:%02d", normalizedHours, normalizedMinutes)
    )
  }

  private func normalizedAgendaSummary(normalizedSessions: [MeetupSessionDTO]) -> String? {
    let sessionTitles = normalizedSessions
      .map(\.title)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    guard !sessionTitles.isEmpty else {
      return nil
    }

    return sessionTitles.joined(separator: " | ")
  }

  private var normalizedDescription: String? {
    guard
      let summary = stripHTML(description)?
        .trimmingCharacters(in: .whitespacesAndNewlines),
      !summary.isEmpty,
      summary != "No meetup description published yet."
    else {
      return nil
    }

    return summary
  }

  private var normalizedContractStatus: MeetupContractStatusDTO {
    switch status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
    case "postponed":
      return .postponed
    case "canceled", "cancelled":
      return .canceled
    default:
      guard let startsAt, let endsAt else {
        return .scheduled
      }

      let now = Date()
      if now < startsAt {
        return .scheduled
      }

      if now <= endsAt {
        return .ongoing
      }

      return .completed
    }
  }

  private func normalizedRsvpLink(meetupURL: String) -> String? {
    if let rsvpLink = normalizedHTTPSURLString(rsvpLink) {
      return rsvpLink
    }

    if acceptingRsvp?.value == true {
      return meetupURL
    }

    return nil
  }

  private static func computeSeatsRemaining(capacityTotal: Int?, rsvpCount: Int?) -> Int? {
    guard let capacityTotal, let rsvpCount else {
      return nil
    }

    return max(capacityTotal - rsvpCount, 0)
  }
}

struct CodersMuMeetupDTO: Decodable {
  let id: String
  let title: String
  let description: String?
  let sessions: [CodersMuSessionDTO]?
  let date: String?
  let startTime: String?
  let endTime: String?
  let venue: String?
  let location: String?
  let acceptingRsvp: CodersMuBoolish?
  let attendeeCount: Int?
  let seatsAvailable: Int?
  let rsvpLink: String?
  let rsvpCount: Int?
  let mapUrl: String?
  let parkingLocation: String?
  let status: String?
  let sponsors: [CodersMuSponsorDTO]?

  var startsAt: Date? {
    guard let date else {
      return nil
    }

    return buildUTCDate(date: date, time: normalizeTime(startTime))
  }

  var endsAt: Date? {
    guard let date, let start = startsAt else {
      return nil
    }

    guard let endTime else {
      return start.addingTimeInterval(Double(defaultDurationHours * 60 * 60))
    }

    let startMinutes = toMinutes(normalizeTime(startTime))
    var endMinutes = toMinutes(normalizeTime(endTime))

    if endMinutes <= startMinutes {
      endMinutes += 24 * 60
    }

    let normalizedHours = (endMinutes / 60) % 24
    let normalizedMinutes = endMinutes % 60
    let dayOffset = endMinutes / (24 * 60)
    let localDate = addDays(to: date, days: dayOffset)

    return buildUTCDate(
      date: localDate,
      time: String(format: "%02d:%02d", normalizedHours, normalizedMinutes)
    )
  }

  func toContract() throws -> MeetupDTO {
    guard let date else {
      throw APIError.invalidPayload("Meetup \(id) does not have a date.")
    }

    let cleanTitle = stripHTML(title) ?? title
    let venueName = normalizeLocationValue(stripHTML(venue) ?? "TBA")
    let venueAddress = normalizeLocationValue(stripHTML(location))
    let encodedId = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    let meetupURL = "\(meetupDetailURLPrefix)\(encodedId)"
    let normalizedSessions = sessions?.map { session in
      MeetupSessionDTO(
        id: session.id,
        title: stripHTML(session.title) ?? session.title,
        description: stripHTML(session.description),
        durationMinutes: session.durationMinutes,
        speakers: (session.speakers ?? []).map { speaker in
          MeetupSpeakerDTO(
            name: speaker.name,
            title: stripHTML(speaker.title),
            githubUsername: speaker.githubUsername,
            avatarUrl: speaker.avatarUrl,
            featured: speaker.featured?.value
          )
        }
      )
    } ?? []
    let normalizedDescription = normalizedDescription
    let normalizedAgendaSummary = normalizedAgendaSummary

    return MeetupDTO(
      id: id,
      slug: "\(date.prefix(10))-\(slugify(cleanTitle))",
      title: cleanTitle,
      summary: normalizedDescription ?? normalizedAgendaSummary ?? "No meetup description published yet.",
      descriptionText: normalizedDescription,
      agendaSummary: normalizedAgendaSummary,
      startsAt: startsAt?.iso8601String ?? buildUTCDate(date: date, time: normalizeTime(startTime))?.iso8601String ?? "",
      endsAt: endsAt?.iso8601String ?? buildUTCDate(date: date, time: normalizeTime(startTime))?.addingTimeInterval(Double(defaultDurationHours * 60 * 60)).iso8601String ?? "",
      timezone: "Indian/Mauritius",
      status: normalizedContractStatus,
      location: MeetupLocationDTO(
        name: venueName ?? "TBA",
        address: venueAddress,
        city: nil
      ),
      speakers: dedupeSpeakers(from: normalizedSessions),
      sessions: normalizedSessions,
      sponsors: (sponsors ?? []).map { sponsor in
        MeetupSponsorDTO(
          name: sponsor.name,
          website: sponsor.website,
          sponsorTypes: sponsor.sponsorTypes ?? []
        )
      },
      attendeeCount: attendeeCount,
      seatsAvailable: seatsAvailable,
      capacityTotal: seatsAvailable,
      rsvpCount: rsvpCount,
      seatsRemaining: Self.computeSeatsRemaining(capacityTotal: seatsAvailable, rsvpCount: rsvpCount),
      acceptingRsvp: acceptingRsvp?.value,
      links: MeetupLinksDTO(
        meetup: meetupURL,
        recording: nil,
        slides: nil,
        map: normalizedHTTPSURLString(mapUrl),
        parking: normalizedHTTPSURLString(parkingLocation),
        rsvp: normalizedRsvpLink(meetupURL: meetupURL)
      )
    )
  }

  private var normalizedAgendaSummary: String? {
    let sessionTitles = (sessions ?? [])
      .compactMap { session in
        stripHTML(session.title)?.trimmingCharacters(in: .whitespacesAndNewlines)
      }
      .filter { !$0.isEmpty }

    guard !sessionTitles.isEmpty else {
      return nil
    }

    return sessionTitles.joined(separator: " | ")
  }

  private var normalizedDescription: String? {
    guard
      let summary = stripHTML(description)?
        .trimmingCharacters(in: .whitespacesAndNewlines),
      !summary.isEmpty,
      summary != "No meetup description published yet."
    else {
      return nil
    }

    return summary
  }

  private var normalizedContractStatus: MeetupContractStatusDTO {
    switch status?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
    case "postponed":
      return .postponed
    case "canceled", "cancelled":
      return .canceled
    default:
      guard let startsAt, let endsAt else {
        return .scheduled
      }

      let now = Date()
      if now < startsAt {
        return .scheduled
      }

      if now <= endsAt {
        return .ongoing
      }

      return .completed
    }
  }

  private func normalizedRsvpLink(meetupURL: String) -> String? {
    if let rsvpLink = normalizedHTTPSURLString(rsvpLink) {
      return rsvpLink
    }

    if acceptingRsvp?.value == true {
      return meetupURL
    }

    return nil
  }

  private static func computeSeatsRemaining(capacityTotal: Int?, rsvpCount: Int?) -> Int? {
    guard let capacityTotal, let rsvpCount else {
      return nil
    }

    return max(capacityTotal - rsvpCount, 0)
  }
}

private func normalizeTime(_ value: String?, fallback: String = "10:00") -> String {
  let source = value?.trimmingCharacters(in: .whitespacesAndNewlines)
  let raw = (source?.isEmpty == false) ? source! : fallback
  let components = raw.split(separator: ":")
  let hours = components.first.map(String.init) ?? "10"
  let minutes = components.dropFirst().first.map(String.init) ?? "00"
  return "\(hours.leftPadding(toLength: 2, withPad: "0")):\(minutes.leftPadding(toLength: 2, withPad: "0"))"
}

private func buildUTCDate(date: String, time: String) -> Date? {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: "\(String(date.prefix(10)))T\(time):00\(mauritiusUTCOffset)")
}

private func addDays(to date: String, days: Int) -> String {
  let formatter = DateFormatter()
  formatter.calendar = Calendar(identifier: .gregorian)
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  formatter.dateFormat = "yyyy-MM-dd"

  guard
    let startDate = formatter.date(from: String(date.prefix(10))),
    let updatedDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: startDate)
  else {
    return String(date.prefix(10))
  }

  return formatter.string(from: updatedDate)
}

private func toMinutes(_ time: String) -> Int {
  let parts = time.split(separator: ":")
  let hours = Int(parts.first ?? "0") ?? 0
  let minutes = Int(parts.dropFirst().first ?? "0") ?? 0
  return (hours * 60) + minutes
}

private func stripHTML(_ value: String?) -> String? {
  guard let value, !value.isEmpty else {
    return nil
  }

  let normalized = value
    .replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: .regularExpression)
    .replacingOccurrences(of: "</p>", with: "\n\n", options: .regularExpression)
    .replacingOccurrences(of: "<li>", with: "- ", options: .regularExpression)
    .replacingOccurrences(of: "</li>", with: "\n", options: .regularExpression)
    .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    .replacingOccurrences(of: "\r", with: "")
    .replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)

  return decodeHTMLEntities(in: normalized)
}

private func normalizeLocationValue(_ value: String?) -> String? {
  guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
    return nil
  }

  let normalized = trimmed.lowercased()
  if normalized == "tba" || normalized == "tbd" {
    return nil
  }

  return trimmed
}

private func normalizedHTTPSURLString(_ value: String?) -> String? {
  guard
    let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
    !trimmed.isEmpty,
    let url = URL(string: trimmed),
    url.scheme?.lowercased() == "https"
  else {
    return nil
  }

  return url.absoluteString
}

private func normalizedHTTPSURL(_ value: String?) -> URL? {
  guard let normalized = normalizedHTTPSURLString(value) else {
    return nil
  }

  return URL(string: normalized)
}

private func slugify(_ value: String) -> String {
  value
    .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
    .replacingOccurrences(of: "[^a-zA-Z0-9\\s-]", with: "", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
    .lowercased()
    .replacingOccurrences(of: "[\\s_-]+", with: "-", options: .regularExpression)
    .replacingOccurrences(of: "^-+|-+$", with: "", options: .regularExpression)
}

private func dedupeSpeakers(from sessions: [MeetupSessionDTO]) -> [MeetupSpeakerDTO] {
  var seen = Set<String>()
  var speakers: [MeetupSpeakerDTO] = []

  for session in sessions {
    for speaker in session.speakers {
      let key = "\(speaker.name.lowercased()):\(speaker.githubUsername?.lowercased() ?? "")"
      guard !seen.contains(key) else {
        continue
      }

      seen.insert(key)
      speakers.append(speaker)
    }
  }

  return speakers
}

private func parsedDate(_ value: String) -> Date? {
  let formatterWithFractionalSeconds = ISO8601DateFormatter()
  formatterWithFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

  if let date = formatterWithFractionalSeconds.date(from: value) {
    return date
  }

  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: value)
}

func decodeHTMLEntities(in value: String) -> String {
  let replacements = [
    "&quot;": "\"",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&apos;": "'",
    "&#039;": "'",
    "&nbsp;": " ",
  ]

  return replacements.reduce(value) { partialResult, replacement in
    partialResult.replacingOccurrences(of: replacement.key, with: replacement.value)
  }
}

private extension String {
  var trimmedNilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  var normalizedSummary: String? {
    guard let trimmed = trimmedNilIfEmpty else {
      return nil
    }

    return trimmed == "No meetup description published yet." ? nil : trimmed
  }

  var normalizedLocationValue: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return nil
    }

    switch trimmed.lowercased() {
    case "tba", "tbd":
      return nil
    default:
      return trimmed
    }
  }

  func leftPadding(toLength: Int, withPad character: Character) -> String {
    guard count < toLength else {
      return self
    }

    return String(repeating: String(character), count: toLength - count) + self
  }
}

private extension Date {
  var iso8601String: String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: self)
  }
}
