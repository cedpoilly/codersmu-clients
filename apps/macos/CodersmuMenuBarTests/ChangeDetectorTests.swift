import XCTest
@testable import CodersmuMenuBar

final class ChangeDetectorTests: XCTestCase {
  func testInitialSnapshotOnlyProducesNewMeetupEvent() {
    let detector = ChangeDetector()
    let events = detector.detectChanges(from: nil, to: makeSnapshot())

    XCTAssertEqual(events.map(\.kind), [.nextMeetupCreated])
  }

  func testLocationConfirmationIsDetected() {
    let detector = ChangeDetector()
    let oldSnapshot = makeSnapshot(venueName: nil, venueAddress: nil)
    let newSnapshot = makeSnapshot(venueName: "Caudan Arts Centre", venueAddress: "Port Louis")

    let events = detector.detectChanges(from: oldSnapshot, to: newSnapshot)

    XCTAssertTrue(events.contains(where: { $0.kind == .locationConfirmed }))
  }

  func testMostUrgentSeatThresholdIsReportedOnce() {
    let detector = ChangeDetector()
    let oldSnapshot = makeSnapshot(seatsRemaining: 42)
    let newSnapshot = makeSnapshot(seatsRemaining: 9)

    let events = detector.detectChanges(from: oldSnapshot, to: newSnapshot)

    XCTAssertEqual(events.first(where: { $0.kind == .seatThresholdReached })?.seatThreshold, 10)
  }

  func testRepeatedScheduleChangesProduceDistinctFingerprints() {
    let detector = ChangeDetector()
    let original = makeSnapshot()
    let firstChange = makeSnapshot(
      startsAt: Date(timeIntervalSince1970: 1_800_000_300),
      endsAt: Date(timeIntervalSince1970: 1_800_007_500)
    )
    let secondChange = makeSnapshot(
      startsAt: Date(timeIntervalSince1970: 1_800_000_600),
      endsAt: Date(timeIntervalSince1970: 1_800_007_800)
    )

    let firstEvent = detector.detectChanges(from: original, to: firstChange)
      .first(where: { $0.kind == .dateChanged })
    let secondEvent = detector.detectChanges(from: firstChange, to: secondChange)
      .first(where: { $0.kind == .dateChanged })

    XCTAssertNotNil(firstEvent)
    XCTAssertNotNil(secondEvent)
    XCTAssertNotEqual(firstEvent?.fingerprint, secondEvent?.fingerprint)
  }

  func testDateChangesStayOnSameMeetupWhenDisplaySlugChanges() {
    let detector = ChangeDetector()
    let original = makeSnapshot(
      slug: "2026-05-23-the-may-meetup",
      startsAt: Date(timeIntervalSince1970: 1_800_000_000),
      endsAt: Date(timeIntervalSince1970: 1_800_007_200),
      meetupURL: URL(string: "https://coders.mu/meetup/8846d85b-363a-41a1-8249-6034e34efacb")!
    )
    let changed = makeSnapshot(
      slug: "2026-05-24-the-may-meetup",
      startsAt: Date(timeIntervalSince1970: 1_800_086_400),
      endsAt: Date(timeIntervalSince1970: 1_800_093_600),
      meetupURL: URL(string: "https://coders.mu/meetup/8846d85b-363a-41a1-8249-6034e34efacb")!
    )

    let events = detector.detectChanges(from: original, to: changed)

    XCTAssertTrue(events.contains(where: { $0.kind == .dateChanged }))
    XCTAssertFalse(events.contains(where: { $0.kind == .nextMeetupCreated }))
  }

  func testRepeatedLocationChangesProduceDistinctFingerprints() {
    let detector = ChangeDetector()
    let original = makeSnapshot(venueName: "Venue A", venueAddress: "Address A")
    let firstChange = makeSnapshot(venueName: "Venue B", venueAddress: "Address B")
    let secondChange = makeSnapshot(venueName: "Venue C", venueAddress: "Address C")

    let firstEvent = detector.detectChanges(from: original, to: firstChange)
      .first(where: { $0.kind == .locationChanged })
    let secondEvent = detector.detectChanges(from: firstChange, to: secondChange)
      .first(where: { $0.kind == .locationChanged })

    XCTAssertNotNil(firstEvent)
    XCTAssertNotNil(secondEvent)
    XCTAssertNotEqual(firstEvent?.fingerprint, secondEvent?.fingerprint)
  }

  private func makeSnapshot(
    slug: String = "example-meetup",
    venueName: String? = "Spoon Consulting Offices",
    venueAddress: String? = "Moka",
    seatsRemaining: Int? = 30,
    startsAt: Date = Date(timeIntervalSince1970: 1_800_000_000),
    endsAt: Date = Date(timeIntervalSince1970: 1_800_007_200),
    meetupURL: URL = URL(string: "https://example.com/meetup")!
  ) -> MeetupSnapshot {
    MeetupSnapshot(
      slug: slug,
      title: "Example Meetup",
      description: nil,
      startsAt: startsAt,
      endsAt: endsAt,
      venueName: venueName,
      venueAddress: venueAddress,
      meetupURL: meetupURL,
      rsvpURL: URL(string: "https://example.com/rsvp")!,
      seatsRemaining: seatsRemaining,
      status: .upcoming,
      lastSyncedAt: Date(timeIntervalSince1970: 1_800_000_000)
    )
  }
}

final class CodersMuAPIClientTests: XCTestCase {
  override func tearDown() {
    MockURLProtocol.requestHandler = nil
    super.tearDown()
  }

  func testFetchNextMeetupResponseSkipsCanceledCandidates() async throws {
    let indexHTML = try makeDataPageHTML([
      "props": [
        "meetups": [
          [
            "id": "canceled-meetup",
            "title": "Canceled Meetup",
            "date": "2099-04-18",
            "startTime": "10:00",
            "endTime": "14:00",
          ],
          [
            "id": "scheduled-meetup",
            "title": "Scheduled Meetup",
            "date": "2099-05-18",
            "startTime": "10:00",
            "endTime": "14:00",
          ],
        ],
      ],
    ])

    let canceledHTML = try makeDataPageHTML([
      "props": [
        "meetup": [
          "id": "canceled-meetup",
          "title": "Canceled Meetup",
          "date": "2099-04-18",
          "startTime": "10:00",
          "endTime": "14:00",
          "status": "cancelled",
        ],
      ],
    ])

    let scheduledHTML = try makeDataPageHTML([
      "props": [
        "meetup": [
          "id": "scheduled-meetup",
          "title": "Scheduled Meetup",
          "date": "2099-05-18",
          "startTime": "10:00",
          "endTime": "14:00",
        ],
      ],
    ])

    let responses = [
      "https://coders.mu/meetups/": indexHTML,
      "https://coders.mu/meetup/canceled-meetup": canceledHTML,
      "https://coders.mu/meetup/scheduled-meetup": scheduledHTML,
    ]

    MockURLProtocol.requestHandler = { request in
      guard
        let url = request.url?.absoluteString,
        let body = responses[url]
      else {
        throw URLError(.badURL)
      }

      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 200,
        httpVersion: nil,
        headerFields: ["Content-Type": "text/html; charset=utf-8"]
      )!
      return (response, Data(body.utf8))
    }

    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let client = CodersMuAPIClient(session: session)

    let response = try await client.fetchNextMeetupResponse()

    XCTAssertEqual(response.meetup?.id, "scheduled-meetup")
    XCTAssertEqual(response.meetup?.status, .scheduled)
  }
}

final class CliMeetupSourceTests: XCTestCase {
  @MainActor
  func testDecodeSnapshotAcceptsLegacyAndWrappedNextMeetupJSON() throws {
    let meetupPayload: [String: Any] = [
      "slug": "sample-meetup",
      "title": "Sample Meetup",
      "summary": "Sample summary",
      "startsAt": "2099-05-18T06:00:00.000Z",
      "endsAt": "2099-05-18T10:00:00.000Z",
      "status": "scheduled",
      "location": [
        "name": "Spoon Consulting Offices",
        "address": "Moka",
        "city": "Moka",
      ],
      "seatsAvailable": 12,
      "acceptingRsvp": true,
      "links": [
        "meetup": "https://coders.mu/meetup/sample-meetup",
        "rsvp": "https://lu.ma/sample-meetup",
      ],
    ]

    let legacyJSON = try makeJSONString(meetupPayload)
    let wrappedJSON = try makeJSONString(["meetup": meetupPayload])
    let lastSyncedAt = Date(timeIntervalSince1970: 1_800_000_000)
    let source = CliMeetupSource()

    let legacySnapshot = try source.decodeSnapshot(from: legacyJSON, lastSyncedAt: lastSyncedAt)
    let wrappedSnapshot = try source.decodeSnapshot(from: wrappedJSON, lastSyncedAt: lastSyncedAt)

    XCTAssertEqual(legacySnapshot, wrappedSnapshot)
    XCTAssertEqual(legacySnapshot?.slug, "sample-meetup")
    XCTAssertEqual(legacySnapshot?.status, .upcoming)
    XCTAssertEqual(legacySnapshot?.rsvpURL?.absoluteString, "https://lu.ma/sample-meetup")
  }
}

private final class MockURLProtocol: URLProtocol {
  nonisolated(unsafe) static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

  override class func canInit(with request: URLRequest) -> Bool {
    true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    guard let handler = MockURLProtocol.requestHandler else {
      client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
      return
    }

    do {
      let (response, data) = try handler(request)
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}
}

private func makeDataPageHTML(_ payload: [String: Any]) throws -> String {
  let json = try makeJSONString(payload)
  let encoded = json
    .replacingOccurrences(of: "&", with: "&amp;")
    .replacingOccurrences(of: "\"", with: "&quot;")
    .replacingOccurrences(of: "<", with: "&lt;")
    .replacingOccurrences(of: ">", with: "&gt;")
    .replacingOccurrences(of: "'", with: "&#039;")

  return """
  <html>
    <body>
      <div id="app" data-page="\(encoded)"></div>
    </body>
  </html>
  """
}

private func makeJSONString(_ payload: [String: Any]) throws -> String {
  let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
  guard let string = String(data: data, encoding: .utf8) else {
    throw URLError(.cannotDecodeRawData)
  }
  return string
}
