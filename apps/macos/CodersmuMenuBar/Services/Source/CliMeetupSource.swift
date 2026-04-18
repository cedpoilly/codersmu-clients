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

    guard let data = output.data(using: .utf8) else {
      throw CliMeetupSourceError.invalidOutput("CLI did not return UTF-8 output.")
    }

    let decoder = JSONDecoder()

    if let response = try? decoder.decode(CliNextMeetupResponse.self, from: data) {
      return response.meetup?.snapshot(lastSyncedAt: Date())
    }

    let meetup = try decoder.decode(CliMeetup.self, from: data)
    return meetup.snapshot(lastSyncedAt: Date())
  }
}

private extension CliMeetupSource {
  func resolveCliInvocation() throws -> (executableURL: URL, arguments: [String]) {
    let root = try findWorkspaceRoot(startingAt: Bundle.main.bundleURL)
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

private struct CliMeetup: Decodable {
  struct Location: Decodable {
    let name: String?
    let address: String?
    let city: String?
  }

  struct Links: Decodable {
    let meetup: String
    let rsvp: String?
  }

  let slug: String
  let title: String
  let summary: String
  let startsAt: String
  let endsAt: String
  let status: String
  let location: Location
  let seatsAvailable: Int?
  let acceptingRsvp: Bool?
  let links: Links

  func snapshot(lastSyncedAt: Date) -> MeetupSnapshot {
    MeetupSnapshot(
      slug: slug,
      title: title,
      description: summary.normalizedSummary,
      startsAt: parsedDate(startsAt),
      endsAt: parsedDate(endsAt),
      venueName: location.name?.normalizedLocationValue,
      venueAddress: [location.address?.normalizedLocationValue, location.city?.normalizedLocationValue]
        .compactMap { $0 }
        .joined(separator: ", ")
        .trimmedNilIfEmpty,
      meetupURL: URL(string: links.meetup)!,
      rsvpURL: normalizedRsvpURL,
      seatsRemaining: seatsAvailable,
      status: normalizedStatus,
      lastSyncedAt: lastSyncedAt
    )
  }

  private var normalizedRsvpURL: URL? {
    if let rsvp = links.rsvp, let url = URL(string: rsvp) {
      return url
    }

    if acceptingRsvp ?? false {
      return URL(string: links.meetup)
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
}

private struct CliNextMeetupResponse: Decodable {
  let meetup: CliMeetup?
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

private extension String {
  var trimmedNilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  var normalizedSummary: String? {
    guard let trimmed = trimmedNilIfEmpty else {
      return nil
    }

    if trimmed == "No meetup description published yet." {
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
