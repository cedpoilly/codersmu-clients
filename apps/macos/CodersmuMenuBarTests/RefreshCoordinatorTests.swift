import XCTest
@testable import CodersmuMenuBar

@MainActor
final class RefreshCoordinatorTests: XCTestCase {
  func testRefreshReportsSnapshotSaveFailures() async {
    let snapshot = SampleData.nextMeetup
    let source = StubMeetupSource(snapshot: snapshot)
    let snapshotStore = FailingSnapshotStore()
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: source,
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )

    let outcome = await coordinator.refresh(trigger: .manual, preferences: .default)

    XCTAssertEqual(outcome.snapshot, snapshot)
    XCTAssertEqual(outcome.errorDescription, "Couldn't refresh Coders.mu right now.")
    XCTAssertFalse(notificationService.notifiedEvents.isEmpty)
  }

  func testChangeSimulationsRequireABaselineSnapshot() {
    XCTAssertNil(DeveloperInjectedEvent.dateChanged.applying(to: nil))
    XCTAssertNil(DeveloperInjectedEvent.locationChanged.applying(to: nil))
    XCTAssertNil(DeveloperInjectedEvent.seatThresholdReached.applying(to: nil))
    XCTAssertNil(DeveloperInjectedEvent.meetupPostponed.applying(to: nil))
  }

  func testNextMeetupSimulationCanCreateASyntheticSnapshot() {
    let simulatedSnapshot = DeveloperInjectedEvent.nextMeetupCreated.applying(to: nil)

    XCTAssertEqual(simulatedSnapshot?.title, "Developer Test Meetup")
    XCTAssertEqual(simulatedSnapshot?.status, .upcoming)
    XCTAssertNotNil(simulatedSnapshot?.meetupURL)
  }

  func testRefreshRetainsDeliveredFingerprintsForSameMeetupWhenSlugChanges() async {
    let previousSnapshot = makeSnapshot(
      slug: "2026-05-23-the-may-meetup",
      meetupURL: URL(string: "https://coders.mu/meetup/8846d85b-363a-41a1-8249-6034e34efacb")!,
      rsvpURL: nil
    )
    let latestSnapshot = makeSnapshot(
      slug: "2026-05-24-the-may-meetup",
      meetupURL: URL(string: "https://coders.mu/meetup/8846d85b-363a-41a1-8249-6034e34efacb")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/8846d85b-363a-41a1-8249-6034e34efacb")!
    )
    let deliveredFingerprint = "\(previousSnapshot.changeIdentity):\(MeetupChangeKind.rsvpOpened.rawValue)"
    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: previousSnapshot,
      deliveredFingerprints: [deliveredFingerprint],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: latestSnapshot),
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )

    let outcome = await coordinator.refresh(trigger: .manual, preferences: .default)

    XCTAssertTrue(outcome.events.isEmpty)
    XCTAssertEqual(snapshotStore.savedStates.last?.deliveredFingerprints, [deliveredFingerprint])
    XCTAssertTrue(notificationService.notifiedEvents.isEmpty)
  }

  func testCliMeetupSnapshotKeepsScheduleNilWhenStartTimeIsMissing() throws {
    let data = Data("""
    {
      "id": "future-meetup",
      "title": "The Test Meetup",
      "description": null,
      "date": "2099-04-18",
      "startTime": null,
      "endTime": null,
      "venue": "The Venue",
      "location": "Moka",
      "acceptingRsvp": 0,
      "status": "published"
    }
    """.utf8)

    let meetup = try JSONDecoder().decode(CliMeetup.self, from: data)
    let snapshot = meetup.snapshot(lastSyncedAt: Date(timeIntervalSince1970: 1_800_000_000))

    XCTAssertNil(snapshot.startsAt)
    XCTAssertNil(snapshot.endsAt)
  }

  func testSimulateNewMeetupDoesNotRequireALiveBaseline() async {
    let defaults = UserDefaults(suiteName: "RefreshCoordinatorTests-\(UUID().uuidString)")!

    let snapshotStore = RecordingSnapshotStore(state: .empty)
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: ThrowingMeetupSource(),
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )
    let model = AppModel(
      coordinator: coordinator,
      scheduler: RefreshScheduler(intervalProvider: { .seconds(3600) }),
      preferencesStore: AppPreferencesStore(userDefaults: defaults),
      launchAtLoginManager: LaunchAtLoginManager()
    )

    await model.simulateDeveloperEvent(.nextMeetupCreated)

    XCTAssertEqual(model.snapshot?.title, "Developer Test Meetup")
    XCTAssertEqual(model.refreshState, .idle)
  }

  private func makeSnapshot(
    slug: String,
    meetupURL: URL,
    rsvpURL: URL?
  ) -> MeetupSnapshot {
    MeetupSnapshot(
      slug: slug,
      title: "Example Meetup",
      description: nil,
      startsAt: Date(timeIntervalSince1970: 1_800_000_000),
      endsAt: Date(timeIntervalSince1970: 1_800_007_200),
      venueName: "Venue",
      venueAddress: "Address",
      meetupURL: meetupURL,
      rsvpURL: rsvpURL,
      seatsRemaining: 30,
      status: .upcoming,
      lastSyncedAt: Date(timeIntervalSince1970: 1_800_000_000)
    )
  }
}

private struct StubMeetupSource: MeetupSource {
  let snapshot: MeetupSnapshot?

  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    snapshot
  }
}

private struct ThrowingMeetupSource: MeetupSource {
  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    throw TestError.fetchFailed
  }
}

private final class FailingSnapshotStore: SnapshotStore {
  func loadState() throws -> PersistedAppState {
    .empty
  }

  func saveState(_ state: PersistedAppState) throws {
    throw TestError.writeFailed
  }
}

private final class RecordingSnapshotStore: SnapshotStore {
  private let loadedState: PersistedAppState
  private(set) var savedStates: [PersistedAppState] = []

  init(state: PersistedAppState) {
    self.loadedState = state
  }

  func loadState() throws -> PersistedAppState {
    loadedState
  }

  func saveState(_ state: PersistedAppState) throws {
    savedStates.append(state)
  }
}

@MainActor
private final class RecordingNotificationService: NotificationService {
  private(set) var notifiedEvents: [MeetupChangeEvent] = []

  func requestAuthorization() async {}

  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async {
    notifiedEvents = events
  }
}

private enum TestError: Error {
  case writeFailed
  case fetchFailed
}
