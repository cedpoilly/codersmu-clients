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

  private func makeSnapshot(
    venueName: String? = "Spoon Consulting Offices",
    venueAddress: String? = "Moka",
    seatsRemaining: Int? = 30
  ) -> MeetupSnapshot {
    MeetupSnapshot(
      slug: "example-meetup",
      title: "Example Meetup",
      description: nil,
      startsAt: Date(timeIntervalSince1970: 1_800_000_000),
      endsAt: Date(timeIntervalSince1970: 1_800_007_200),
      venueName: venueName,
      venueAddress: venueAddress,
      meetupURL: URL(string: "https://example.com/meetup")!,
      rsvpURL: URL(string: "https://example.com/rsvp")!,
      seatsRemaining: seatsRemaining,
      status: .upcoming,
      lastSyncedAt: Date(timeIntervalSince1970: 1_800_000_000)
    )
  }
}
