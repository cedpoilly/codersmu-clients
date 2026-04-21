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
    XCTAssertEqual(outcome.debugSummary, "Refresh failed: \(TestError.writeFailed.localizedDescription)")
    XCTAssertFalse(notificationService.notifiedEvents.isEmpty)
  }

  func testChangeSimulationsCanCreateSyntheticBaselines() {
    XCTAssertNotNil(DeveloperInjectedEvent.dateChanged.applying(to: nil))
    XCTAssertNotNil(DeveloperInjectedEvent.locationChanged.applying(to: nil))
    XCTAssertNotNil(DeveloperInjectedEvent.descriptionChanged.applying(to: nil))
    XCTAssertNotNil(DeveloperInjectedEvent.agendaChanged.applying(to: nil))
    XCTAssertNotNil(DeveloperInjectedEvent.seatThresholdReached.applying(to: nil))
    XCTAssertNotNil(DeveloperInjectedEvent.meetupPostponed.applying(to: nil))
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
    XCTAssertEqual(outcome.debugSummary, "Refresh completed. Change already notified earlier: RSVP is now open for the next meetup.")
    XCTAssertEqual(snapshotStore.savedStates.last?.deliveredFingerprints, [deliveredFingerprint])
    XCTAssertTrue(notificationService.notifiedEvents.isEmpty)
  }

  func testRefreshReportsWhenNoTrackedChangesAreDetected() async {
    let snapshot = makeSnapshot(
      slug: "steady-state",
      meetupURL: URL(string: "https://coders.mu/meetup/steady-state")!,
      rsvpURL: nil
    )
    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: snapshot,
      deliveredFingerprints: [],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: snapshot),
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )

    let outcome = await coordinator.refresh(trigger: .manual, preferences: .default)

    XCTAssertTrue(outcome.events.isEmpty)
    XCTAssertEqual(outcome.debugSummary, "Refresh completed. No tracked changes detected.")
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

  func testCliMeetupSnapshotRollsOvernightEndTimeIntoNextDay() throws {
    let data = Data("""
    {
      "id": "overnight-meetup",
      "title": "Overnight Meetup",
      "description": null,
      "date": "2099-04-18",
      "startTime": "08:00",
      "endTime": "07:00",
      "venue": "The Venue",
      "location": "Moka",
      "acceptingRsvp": 0,
      "status": "published"
    }
    """.utf8)

    let meetup = try JSONDecoder().decode(CliMeetup.self, from: data)
    let snapshot = meetup.snapshot(lastSyncedAt: Date(timeIntervalSince1970: 1_800_000_000))

    XCTAssertEqual(snapshot.startsAt, ISO8601DateFormatter().date(from: "2099-04-18T04:00:00Z"))
    XCTAssertEqual(snapshot.endsAt, ISO8601DateFormatter().date(from: "2099-04-19T03:00:00Z"))
  }

  func testSimulateLocationChangeFallsBackToSyntheticBaselineWhenSourceFails() async {
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

    await model.simulateDeveloperEvent(.locationChanged)

    XCTAssertEqual(model.refreshState, RefreshState.idle, "Simulation must succeed even when the live fetch throws.")
    XCTAssertNotNil(model.snapshot, "A synthetic baseline should drive the simulated snapshot when the source is unavailable.")
    XCTAssertEqual(notificationService.notificationBatches.last?.first?.kind, .locationChanged)
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
    XCTAssertEqual(model.refreshState, RefreshState.idle)
  }

  func testRepeatedLocationSimulationProducesFreshNotificationEvents() async {
    let defaults = UserDefaults(suiteName: "RefreshCoordinatorTests-\(UUID().uuidString)")!
    let baselineSnapshot = makeSnapshot(
      slug: "location-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/location-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/location-baseline")!,
      venueName: "Original Venue",
      venueAddress: "Original Address"
    )

    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: baselineSnapshot,
      deliveredFingerprints: [],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: baselineSnapshot),
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
    model.snapshot = baselineSnapshot

    await model.simulateDeveloperEvent(DeveloperInjectedEvent.locationChanged)
    let firstLocation = model.snapshot?.locationDescription
    let firstBatch = notificationService.notificationBatches.last ?? []

    await model.simulateDeveloperEvent(DeveloperInjectedEvent.locationChanged)
    let secondLocation = model.snapshot?.locationDescription
    let secondBatch = notificationService.notificationBatches.last ?? []

    XCTAssertNotEqual(firstLocation, secondLocation)
    XCTAssertEqual(firstBatch.first?.kind, .locationChanged)
    XCTAssertEqual(secondBatch.first?.kind, .locationChanged)
  }

  func testDescriptionSimulationTriggersDescriptionNotification() async {
    let defaults = UserDefaults(suiteName: "RefreshCoordinatorTests-\(UUID().uuidString)")!
    let baselineSnapshot = makeSnapshot(
      slug: "description-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/description-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/description-baseline")!
    )

    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: baselineSnapshot,
      deliveredFingerprints: [],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: baselineSnapshot),
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
    model.snapshot = baselineSnapshot

    await model.simulateDeveloperEvent(.descriptionChanged)

    XCTAssertEqual(notificationService.notificationBatches.last?.first?.kind, .descriptionChanged)
    XCTAssertEqual(model.refreshState, RefreshState.idle)
  }

  func testAgendaSimulationTriggersAgendaNotification() async {
    let defaults = UserDefaults(suiteName: "RefreshCoordinatorTests-\(UUID().uuidString)")!
    let baselineSnapshot = makeSnapshot(
      slug: "agenda-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/agenda-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/agenda-baseline")!
    )

    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: baselineSnapshot,
      deliveredFingerprints: [],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: baselineSnapshot),
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
    model.snapshot = baselineSnapshot

    await model.simulateDeveloperEvent(.agendaChanged)

    XCTAssertEqual(notificationService.notificationBatches.last?.first?.kind, .agendaChanged)
    XCTAssertEqual(model.refreshState, RefreshState.idle)
  }

  func testSeatThresholdSimulationStillFiresFromALowSeatBaseline() async {
    let defaults = UserDefaults(suiteName: "RefreshCoordinatorTests-\(UUID().uuidString)")!
    let baselineSnapshot = makeSnapshot(
      slug: "seats-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/seats-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/seats-baseline")!,
      seatsRemaining: 5
    )

    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: baselineSnapshot,
      deliveredFingerprints: [],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: baselineSnapshot),
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
    model.snapshot = baselineSnapshot

    await model.simulateDeveloperEvent(DeveloperInjectedEvent.seatThresholdReached)

    XCTAssertEqual(notificationService.notificationBatches.last?.first?.kind, .seatThresholdReached)
    XCTAssertEqual(model.snapshot?.seatsRemaining, 5)
    XCTAssertEqual(model.refreshState, RefreshState.idle)
  }

  func testSimulationDoesNotPoisonPersistedSnapshotForLiveRefresh() async {
    let liveBaseline = makeSnapshot(
      slug: "live-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/live-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/live-baseline")!,
      venueName: "Real Venue",
      venueAddress: "Real Address"
    )
    let deliveredFingerprint = "\(liveBaseline.changeIdentity):\(MeetupChangeKind.rsvpOpened.rawValue)"
    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: liveBaseline,
      deliveredFingerprints: [deliveredFingerprint],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: liveBaseline),
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )

    _ = await coordinator.simulate(
      previousSnapshot: liveBaseline,
      latestSnapshot: DeveloperInjectedEvent.locationChanged.applying(to: liveBaseline),
      preferences: .default
    )

    XCTAssertTrue(snapshotStore.savedStates.isEmpty, "Simulation must not write to the durable snapshot store.")

    let outcome = await coordinator.refresh(trigger: .scheduled, preferences: .default)

    XCTAssertEqual(outcome.snapshot, liveBaseline)
    XCTAssertTrue(outcome.events.isEmpty, "Live refresh after simulation must not emit false change events.")
    XCTAssertEqual(snapshotStore.savedStates.last?.deliveredFingerprints, [deliveredFingerprint])
  }

  func testSimulationPreservesRealDeliveredFingerprints() async {
    let liveBaseline = makeSnapshot(
      slug: "fingerprint-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/fingerprint-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/fingerprint-baseline")!
    )
    let deliveredFingerprint = "\(liveBaseline.changeIdentity):\(MeetupChangeKind.rsvpOpened.rawValue)"
    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: liveBaseline,
      deliveredFingerprints: [deliveredFingerprint],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: liveBaseline),
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )

    _ = await coordinator.simulate(
      previousSnapshot: liveBaseline,
      latestSnapshot: DeveloperInjectedEvent.meetupPostponed.applying(to: liveBaseline),
      preferences: .default
    )

    let reloadedState = try? snapshotStore.loadState()
    XCTAssertEqual(
      reloadedState?.deliveredFingerprints,
      [deliveredFingerprint],
      "Simulation must not mutate the real deliveredFingerprints set."
    )
    XCTAssertEqual(reloadedState?.snapshot, liveBaseline)
  }

  func testPostponedSimulationStillFiresWhenSnapshotIsAlreadyPostponed() async {
    let defaults = UserDefaults(suiteName: "RefreshCoordinatorTests-\(UUID().uuidString)")!
    var baselineSnapshot = makeSnapshot(
      slug: "postponed-baseline",
      meetupURL: URL(string: "https://coders.mu/meetup/postponed-baseline")!,
      rsvpURL: URL(string: "https://coders.mu/meetup/postponed-baseline")!
    )
    baselineSnapshot.status = MeetupStatus.postponed

    let snapshotStore = RecordingSnapshotStore(state: PersistedAppState(
      snapshot: baselineSnapshot,
      deliveredFingerprints: [],
      lastRefreshAt: nil
    ))
    let notificationService = RecordingNotificationService()
    let coordinator = RefreshCoordinator(
      source: StubMeetupSource(snapshot: baselineSnapshot),
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
    model.snapshot = baselineSnapshot

    await model.simulateDeveloperEvent(DeveloperInjectedEvent.meetupPostponed)

    XCTAssertEqual(notificationService.notificationBatches.last?.first?.kind, .meetupCanceledOrPostponed)
    XCTAssertEqual(model.snapshot?.status, MeetupStatus.postponed)
    XCTAssertEqual(model.refreshState, RefreshState.idle)
  }

  private func makeSnapshot(
    slug: String,
    meetupURL: URL,
    rsvpURL: URL?,
    venueName: String = "Venue",
    venueAddress: String = "Address",
    seatsRemaining: Int? = 30
  ) -> MeetupSnapshot {
    MeetupSnapshot(
      slug: slug,
      title: "Example Meetup",
      description: nil,
      agendaSummary: nil,
      startsAt: Date(timeIntervalSince1970: 1_800_000_000),
      endsAt: Date(timeIntervalSince1970: 1_800_007_200),
      venueName: venueName,
      venueAddress: venueAddress,
      meetupURL: meetupURL,
      rsvpURL: rsvpURL,
      seatsRemaining: seatsRemaining,
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
  private var currentState: PersistedAppState
  private(set) var savedStates: [PersistedAppState] = []

  init(state: PersistedAppState) {
    self.currentState = state
  }

  func loadState() throws -> PersistedAppState {
    currentState
  }

  func saveState(_ state: PersistedAppState) throws {
    currentState = state
    savedStates.append(state)
  }
}

@MainActor
private final class RecordingNotificationService: NotificationService {
  private(set) var notifiedEvents: [MeetupChangeEvent] = []
  private(set) var notificationBatches: [[MeetupChangeEvent]] = []

  func requestAuthorization() async {}

  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async -> [NotificationDeliveryResult] {
    notifiedEvents = events
    notificationBatches.append(events)
    return events.map { _ in .scheduled("Scheduled in tests.") }
  }
}

private enum TestError: Error {
  case writeFailed
  case fetchFailed
}
