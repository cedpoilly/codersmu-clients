import Foundation

struct CliMeetupSource: MeetupSource {
  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    let invocation = try resolveCliInvocation()
    let process = Process()
    process.executableURL = invocation.executableURL
    process.arguments = invocation.arguments

    var environment = ProcessInfo.processInfo.environment
    environment["NO_COLOR"] = "1"
    process.environment = environment

    let stdout = Pipe()
    let stderr = Pipe()
    process.standardOutput = stdout
    process.standardError = stderr

    try process.run()
    process.waitUntilExit()

    let output = try readUTF8(from: stdout)
    let errorOutput = try readUTF8(from: stderr)

    if process.terminationStatus != 0 {
      if errorOutput.localizedCaseInsensitiveContains("no upcoming meetup found") {
        return nil
      }

      throw CliMeetupSourceError.commandFailed(errorOutput.trimmedNilIfEmpty ?? "Unknown CLI error.")
    }

    return try decodeSnapshot(from: output, lastSyncedAt: Date())
  }

  func decodeSnapshot(from output: String, lastSyncedAt: Date) throws -> MeetupSnapshot? {
    guard let data = output.data(using: .utf8) else {
      throw CliMeetupSourceError.invalidOutput("CLI did not return UTF-8 output.")
    }

    let decoder = JSONDecoder()

    let topLevelObject = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    if let topLevelObject, topLevelObject.keys.contains("meetup") {
      if let response = try? decoder.decode(CliNextMeetupResponse.self, from: data) {
        return response.meetup?.snapshot(lastSyncedAt: lastSyncedAt)
      }

      let response = try decoder.decode(LegacyCliNextMeetupResponse.self, from: data)
      return response.meetup?.snapshot(lastSyncedAt: lastSyncedAt)
    }

    if let meetup = try? decoder.decode(CliMeetup.self, from: data) {
      return meetup.snapshot(lastSyncedAt: lastSyncedAt)
    }

    let meetup = try decoder.decode(LegacyCliMeetup.self, from: data)
    return meetup.snapshot(lastSyncedAt: lastSyncedAt)
  }
}

private extension CliMeetupSource {
  func resolveCliInvocation() throws -> (executableURL: URL, arguments: [String]) {
    let root = try resolveWorkspaceRoot()
    let cliURL = root.appendingPathComponent("dist/cli.mjs")
    let nodeURL = try resolveNodeExecutableURL()

    guard FileManager.default.fileExists(atPath: cliURL.path) else {
      throw CliMeetupSourceError.cliNotFound(cliURL.path)
    }

    return (
      executableURL: nodeURL,
      arguments: [cliURL.path, "next", "--json", "--refresh"]
    )
  }

  func resolveWorkspaceRoot() throws -> URL {
    if let override = ProcessInfo.processInfo.environment["CODERSMU_WORKSPACE_ROOT"]?.trimmedNilIfEmpty {
      let url = URL(fileURLWithPath: override, isDirectory: true)
      let packageJSON = url.appendingPathComponent("package.json")
      let cliURL = url.appendingPathComponent("dist/cli.mjs")

      if FileManager.default.fileExists(atPath: packageJSON.path)
        && FileManager.default.fileExists(atPath: cliURL.path) {
        return url
      }
    }

    return try findWorkspaceRoot(startingAt: Bundle.main.bundleURL)
  }

  func resolveNodeExecutableURL() throws -> URL {
    let fileManager = FileManager.default
    let homeDirectory = fileManager.homeDirectoryForCurrentUser.path
    let candidates = [
      ProcessInfo.processInfo.environment["CODERSMU_NODE_PATH"],
      ProcessInfo.processInfo.environment["NODE_BINARY"],
      "/opt/homebrew/opt/node@24/bin/node",
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "\(homeDirectory)/Library/pnpm/node",
    ]
      .compactMap { $0 }

    if let nodePath = candidates.first(where: { fileManager.isExecutableFile(atPath: $0) }) {
      return URL(fileURLWithPath: nodePath)
    }

    throw CliMeetupSourceError.nodeNotFound(candidates)
  }

  func findWorkspaceRoot(startingAt url: URL) throws -> URL {
    var currentURL = url.standardizedFileURL

    for _ in 0..<12 {
      let packageJSON = currentURL.appendingPathComponent("package.json")
      let cliURL = currentURL.appendingPathComponent("dist/cli.mjs")

      if FileManager.default.fileExists(atPath: packageJSON.path)
        && FileManager.default.fileExists(atPath: cliURL.path) {
        return currentURL
      }

      let parentURL = currentURL.deletingLastPathComponent()
      if parentURL == currentURL {
        break
      }
      currentURL = parentURL
    }

    throw CliMeetupSourceError.workspaceRootNotFound
  }

  func readUTF8(from pipe: Pipe) throws -> String {
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    guard let output = String(data: data, encoding: .utf8) else {
      throw CliMeetupSourceError.invalidOutput("CLI returned non-UTF-8 data.")
    }
    return output
  }
}

struct CliMeetup: Decodable {
  let id: String
  let slug: String?
  let title: String
  let description: String?
  let date: String?
  let startTime: String?
  let endTime: String?
  let venue: String?
  let location: String?
  let acceptingRsvp: FlexibleBool?
  let status: String
  let seatsAvailable: Int?
  let rsvpLink: String?

  func snapshot(lastSyncedAt: Date) -> MeetupSnapshot {
    let derivedSlug = slug?.trimmedNilIfEmpty ?? derivedSlugFromDateAndTitle
    let meetupURL = URL(string: "https://coders.mu/meetup/\(slug?.trimmedNilIfEmpty ?? id)")!

    return MeetupSnapshot(
      slug: derivedSlug,
      title: title,
      description: description?.normalizedSummary,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      venueName: venue?.normalizedLocationValue,
      venueAddress: location?.normalizedLocationValue,
      meetupURL: meetupURL,
      rsvpURL: normalizedRsvpURL,
      seatsRemaining: seatsAvailable,
      status: normalizedStatus,
      lastSyncedAt: lastSyncedAt
    )
  }

  private var startsAtDate: Date? {
    guard let date, let startTime = startTime?.trimmedNilIfEmpty else {
      return nil
    }

    return buildUtcDate(date: date, time: startTime)
  }

  private var endsAtDate: Date? {
    guard let date, let startTime = startTime?.trimmedNilIfEmpty else {
      return nil
    }

    if let endTime = endTime?.trimmedNilIfEmpty {
      return buildEndDate(date: date, startTime: startTime, endTime: endTime)
    }

    guard let startsAtDate else {
      return nil
    }

    return Calendar.current.date(byAdding: .hour, value: 4, to: startsAtDate)
  }

  private var derivedSlugFromDateAndTitle: String {
    if let date {
      return "\(date.prefix(10))-\(title.slugified)"
    }

    return id
  }

  private var normalizedRsvpURL: URL? {
    if let url = normalizedHTTPSURL(rsvpLink) {
      return url
    }

    if acceptingRsvp?.boolValue ?? false {
      return URL(string: "https://coders.mu/meetup/\(slug?.trimmedNilIfEmpty ?? id)")
    }

    return nil
  }

  private var normalizedStatus: MeetupStatus {
    switch status.lowercased() {
    case "postponed":
      return .postponed
    case "canceled", "cancelled":
      return .canceled
    default:
      return .upcoming
    }
  }
}

struct FlexibleBool: Decodable {
  let boolValue: Bool

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let boolValue = try? container.decode(Bool.self) {
      self.boolValue = boolValue
      return
    }

    if let intValue = try? container.decode(Int.self) {
      self.boolValue = intValue != 0
      return
    }

    throw DecodingError.typeMismatch(Bool.self, DecodingError.Context(
      codingPath: decoder.codingPath,
      debugDescription: "Expected a Bool or Int value."
    ))
  }
}

private func buildUtcDate(date: String, time: String) -> Date? {
  let normalizedTime = time.normalizedTime
  let day = String(date.prefix(10))
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: "\(day)T\(normalizedTime):00+04:00")
}

private func buildEndDate(date: String, startTime: String, endTime: String) -> Date? {
  guard let startDate = buildUtcDate(date: date, time: startTime) else {
    return nil
  }

  let startMinutes = startTime.normalizedTime.totalMinutes
  var endMinutes = endTime.normalizedTime.totalMinutes
  if endMinutes <= startMinutes {
    endMinutes += 24 * 60
  }

  return Calendar.current.date(byAdding: .minute, value: endMinutes - startMinutes, to: startDate)
}

private func parseISO8601Date(_ value: String?) -> Date? {
  guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
    return nil
  }

  let formatterWithFractionalSeconds = ISO8601DateFormatter()
  formatterWithFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

  if let date = formatterWithFractionalSeconds.date(from: value) {
    return date
  }

  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: value)
}

private extension String {
  var normalizedTime: String {
    let parts = split(separator: ":", omittingEmptySubsequences: false)
    let hours = parts.first.map(String.init) ?? "10"
    let minutes = parts.count > 1 ? String(parts[1]) : "00"
    return "\(hours.padding(toLength: 2, withPad: "0", startingAt: 0).prefix(2)):\(minutes.padding(toLength: 2, withPad: "0", startingAt: 0).prefix(2))"
  }

  var totalMinutes: Int {
    let parts = normalizedTime.split(separator: ":")
    let hours = Int(parts.first ?? "0") ?? 0
    let minutes = Int(parts.last ?? "0") ?? 0
    return hours * 60 + minutes
  }

  var slugified: String {
    folding(options: .diacriticInsensitive, locale: .current)
      .replacingOccurrences(of: "[^A-Za-z0-9\\s-]", with: "", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
      .replacingOccurrences(of: "[\\s_-]+", with: "-", options: .regularExpression)
      .replacingOccurrences(of: "^-+|-+$", with: "", options: .regularExpression)
  }
}

private struct CliNextMeetupResponse: Decodable {
  let meetup: CliMeetup?
}

private struct LegacyCliNextMeetupResponse: Decodable {
  let meetup: LegacyCliMeetup?
}

private struct LegacyCliMeetup: Decodable {
  struct LegacyLocation: Decodable {
    let name: String?
    let address: String?
    let city: String?
  }

  struct LegacyLinks: Decodable {
    let meetup: String?
    let rsvp: String?
  }

  let slug: String?
  let title: String
  let summary: String?
  let startsAt: String?
  let endsAt: String?
  let status: String?
  let location: LegacyLocation?
  let seatsAvailable: Int?
  let acceptingRsvp: FlexibleBool?
  let links: LegacyLinks?

  func snapshot(lastSyncedAt: Date) -> MeetupSnapshot {
    let derivedSlug = slug?.trimmedNilIfEmpty ?? title.slugified
    let venueAddress = [
      location?.address?.normalizedLocationValue,
      location?.city?.normalizedLocationValue,
    ]
      .compactMap { $0 }
      .joined(separator: ", ")
      .trimmedNilIfEmpty
    let meetupURL = normalizedHTTPSURL(links?.meetup?.trimmedNilIfEmpty)
      ?? URL(string: "https://coders.mu/meetup/\(derivedSlug)")!

    return MeetupSnapshot(
      slug: derivedSlug,
      title: title,
      description: summary?.normalizedSummary,
      startsAt: parseISO8601Date(startsAt),
      endsAt: parseISO8601Date(endsAt),
      venueName: location?.name?.normalizedLocationValue,
      venueAddress: venueAddress,
      meetupURL: meetupURL,
      rsvpURL: normalizedRsvpURL,
      seatsRemaining: seatsAvailable,
      status: normalizedStatus,
      lastSyncedAt: lastSyncedAt
    )
  }

  private var normalizedRsvpURL: URL? {
    if let rsvp = links?.rsvp?.trimmedNilIfEmpty {
      return normalizedHTTPSURL(rsvp)
    }

    guard acceptingRsvp?.boolValue ?? false else {
      return nil
    }

    if let meetup = links?.meetup?.trimmedNilIfEmpty {
      return normalizedHTTPSURL(meetup)
    }

    guard let slug = slug?.trimmedNilIfEmpty else {
      return nil
    }

    return URL(string: "https://coders.mu/meetup/\(slug)")
  }

  private var normalizedStatus: MeetupStatus {
    switch status?.lowercased() {
    case "postponed":
      return .postponed
    case "canceled", "cancelled":
      return .canceled
    default:
      return .upcoming
    }
  }
}

private enum CliMeetupSourceError: LocalizedError {
  case workspaceRootNotFound
  case cliNotFound(String)
  case nodeNotFound([String])
  case invalidOutput(String)
  case commandFailed(String)

  var errorDescription: String? {
    switch self {
    case .workspaceRootNotFound:
      return "Couldn't locate the codersmu-clients workspace from the app bundle."
    case let .cliNotFound(path):
      return "Couldn't find the built CLI at \(path)."
    case let .nodeNotFound(candidates):
      return "Couldn't find a usable Node.js binary. Checked: \(candidates.joined(separator: ", "))"
    case let .invalidOutput(message):
      return message
    case let .commandFailed(message):
      return message
    }
  }
}

private func normalizedHTTPSURL(_ value: String?) -> URL? {
  guard
    let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
    !trimmed.isEmpty,
    let url = URL(string: trimmed),
    url.scheme?.lowercased() == "https"
  else {
    return nil
  }

  return url
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

    return trimmed
  }

  var normalizedLocationValue: String? {
    guard let trimmed = trimmedNilIfEmpty else {
      return nil
    }

    let normalized = trimmed.lowercased()
    if normalized == "tbd" || normalized == "tba" {
      return nil
    }

    return trimmed
  }
}
