import XCTest
@testable import CodersmuMenuBar

@MainActor
final class RefreshCoordinatorTests: XCTestCase {
  func testFixtureLifecycleProgressionDeliversExpectedEvents() async {
    let snapshotStore = InMemorySnapshotStore()
    let systemNotifications = RecordingSystemNotificationService()
    let harness = DebugHarness(
      snapshotStore: snapshotStore,
      liveSource: StaticMeetupSource(snapshot: nil),
      systemNotificationService: systemNotifications
    )
    harness.sourceMode = .fixture
    harness.selectScenario(.fullLifecycle)

    let coordinator = RefreshCoordinator(
      source: harness,
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: harness
    )

    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)
    XCTAssertEqual(systemNotifications.deliveredKinds, [.nextMeetupCreated])

    harness.advanceScenario()
    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)
    XCTAssertEqual(Array(systemNotifications.deliveredKinds.suffix(1)), [.dateConfirmed])

    harness.advanceScenario()
    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)
    XCTAssertEqual(Array(systemNotifications.deliveredKinds.suffix(1)), [.locationConfirmed])

    harness.advanceScenario()
    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)
    XCTAssertEqual(Array(systemNotifications.deliveredKinds.suffix(1)), [.rsvpOpened])
  }

  func testRepeatedRefreshDoesNotDuplicateDeliveredEvents() async {
    let snapshotStore = InMemorySnapshotStore()
    let systemNotifications = RecordingSystemNotificationService()
    let harness = DebugHarness(
      snapshotStore: snapshotStore,
      liveSource: StaticMeetupSource(snapshot: nil),
      systemNotificationService: systemNotifications
    )
    harness.sourceMode = .fixture
    harness.selectScenario(.fullLifecycle)

    let coordinator = RefreshCoordinator(
      source: harness,
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: harness
    )

    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)
    harness.advanceScenario()
    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)

    let deliveredAfterFirstConfirmation = systemNotifications.deliveredKinds
    _ = await coordinator.refresh(trigger: .manual, preferences: testPreferences)

    XCTAssertEqual(systemNotifications.deliveredKinds, deliveredAfterFirstConfirmation)
  }

  func testPausedNotificationsAreRecordedAsSuppressed() async {
    let snapshotStore = InMemorySnapshotStore()
    let systemNotifications = RecordingSystemNotificationService()
    let harness = DebugHarness(
      snapshotStore: snapshotStore,
      liveSource: StaticMeetupSource(snapshot: nil),
      systemNotificationService: systemNotifications
    )
    harness.sourceMode = .fixture

    let coordinator = RefreshCoordinator(
      source: harness,
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: harness
    )

    var pausedPreferences = testPreferences
    pausedPreferences.notificationsPaused = true

    _ = await coordinator.refresh(trigger: .manual, preferences: pausedPreferences)

    XCTAssertTrue(systemNotifications.deliveredKinds.isEmpty)
    XCTAssertEqual(harness.notificationLog.first?.disposition, .suppressedPaused)
    XCTAssertEqual(harness.notificationLog.first?.event.kind, .nextMeetupCreated)
  }

  private var testPreferences: AppPreferences {
    AppPreferences(
      notificationsPaused: false,
      quietHoursEnabled: false,
      quietHours: .overnightDefault,
      snoozedUntil: nil,
      launchAtLoginEnabled: false
    )
  }
}

private final class InMemorySnapshotStore: SnapshotStore {
  private var state: PersistedAppState = .empty

  func loadState() throws -> PersistedAppState {
    state
  }

  func saveState(_ state: PersistedAppState) throws {
    self.state = state
  }
}

@MainActor
private struct StaticMeetupSource: MeetupSource {
  let snapshot: MeetupSnapshot?

  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    snapshot
  }
}

@MainActor
private final class RecordingSystemNotificationService: NotificationService {
  private(set) var deliveredKinds: [MeetupChangeKind] = []

  func requestAuthorization() async {}

  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async {
    deliveredKinds.append(contentsOf: events.map(\.kind))
  }
}
