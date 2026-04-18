import Foundation

struct CodersMuAPIClient {
  private let session: URLSession
  private let hostedAPIBaseURL: URL?
  private let meetupsURL = URL(string: "https://coders.mu/meetups/")!
  private let meetupDetailURLPrefix = "https://coders.mu/meetup/"

  init(session: URLSession = .shared, hostedAPIBaseURL: URL? = CodersMuAPIClient.defaultHostedAPIBaseURL) {
    self.session = session
    self.hostedAPIBaseURL = hostedAPIBaseURL
  }

  func fetchNextMeetupResponse() async throws -> NextMeetupResponseDTO {
    if let hostedAPIBaseURL {
      do {
        return try await fetchHostedNextMeetupResponse(from: hostedAPIBaseURL)
      } catch {
        // Keep the direct-site path as a resilience fallback if the hosted API is unavailable.
      }
    }

    let payload = try await fetchIndexPayload()
    let now = Date()

    let candidateMeetups = payload.props.meetups
      .filter { meetup in
        guard let endsAt = meetup.endsAt else {
          return false
        }

        return endsAt >= now
      }
      .sorted { left, right in
        guard let leftStartsAt = left.startsAt, let rightStartsAt = right.startsAt else {
          return left.id < right.id
        }

        return leftStartsAt < rightStartsAt
      }

    for candidate in candidateMeetups {
      let meetup = try await fetchMeetupDetail(id: candidate.id)
      let contract = try meetup.toContract()

      if contract.status == .canceled {
        continue
      }

      return NextMeetupResponseDTO(meetup: contract)
    }

    return NextMeetupResponseDTO(meetup: nil)
  }

  private func fetchHostedNextMeetupResponse(from baseURL: URL) async throws -> NextMeetupResponseDTO {
    let url = baseURL
      .appendingPathComponent("meetups")
      .appendingPathComponent("next")
    let payload = try await fetchJSON(HostedNextMeetupResponseDTO.self, from: url, accept: "application/json")
    return NextMeetupResponseDTO(meetup: try payload.meetup?.toContract())
  }

  private func fetchIndexPayload() async throws -> CodersMuIndexPayload {
    let html = try await fetchHTML(from: meetupsURL)
    let json = try extractDataPageJSON(from: html)
    let decoder = JSONDecoder()
    return try decoder.decode(CodersMuIndexPayload.self, from: Data(json.utf8))
  }

  private func fetchMeetupDetail(id: String) async throws -> CodersMuMeetupDTO {
    let encodedId = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    guard let detailURL = URL(string: "\(meetupDetailURLPrefix)\(encodedId)") else {
      throw APIError.invalidPayload("Coders.mu returned an unusable meetup id: \(id)")
    }

    let html = try await fetchHTML(from: detailURL)
    let json = try extractDataPageJSON(from: html)
    let decoder = JSONDecoder()
    let payload = try decoder.decode(CodersMuDetailPayload.self, from: Data(json.utf8))
    return payload.props.meetup
  }

  private func fetchJSON<T: Decodable>(_ type: T.Type, from url: URL, accept: String) async throws -> T {
    let data = try await fetchData(from: url, accept: accept)
    let decoder = JSONDecoder()
    return try decoder.decode(type, from: data)
  }

  private func fetchHTML(from url: URL) async throws -> String {
    let data = try await fetchData(from: url, accept: "text/html,application/xhtml+xml")

    guard let html = String(data: data, encoding: .utf8) else {
      throw APIError.invalidPayload("Coders.mu did not return UTF-8 HTML.")
    }

    return html
  }

  private func fetchData(from url: URL, accept: String) async throws -> Data {
    var request = URLRequest(url: url)
    request.timeoutInterval = 10
    request.setValue("codersmu-macos/0.1.0 (+https://coders.mu)", forHTTPHeaderField: "User-Agent")
    request.setValue(accept, forHTTPHeaderField: "Accept")

    let (data, response) = try await session.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIError.invalidResponse
    }

    guard (200..<300).contains(httpResponse.statusCode) else {
      let message = String(data: data, encoding: .utf8) ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
      throw APIError.requestFailed(httpResponse.statusCode, message)
    }

    return data
  }

  private func extractDataPageJSON(from html: String) throws -> String {
    let pattern = #"data-page="([^"]+)""#
    let range = NSRange(location: 0, length: html.utf16.count)
    let regex = try NSRegularExpression(pattern: pattern)

    guard
      let match = regex.firstMatch(in: html, options: [], range: range),
      let payloadRange = Range(match.range(at: 1), in: html)
    else {
      throw APIError.payloadMissing
    }

    return decodeHTMLEntities(in: String(html[payloadRange]))
  }
}

extension CodersMuAPIClient {
  private static var defaultHostedAPIBaseURL: URL? {
    guard let value = ProcessInfo.processInfo.environment["CODERSMU_HOSTED_API_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }

    return URL(string: value)
  }
}
