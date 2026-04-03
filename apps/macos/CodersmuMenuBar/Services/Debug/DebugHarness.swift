import Foundation
import Observation

enum DebugSourceMode: String, CaseIterable, Identifiable {
  case liveCli
  case fixture

  var id: String { rawValue }

  var label: String {
    switch self {
    case .liveCli:
      return "Live CLI"
    case .fixture:
      return "Fixture Scenario"
    }
  }
}

enum DebugFixtureScenario: String, CaseIterable, Identifiable {
  case fullLifecycle
  case meetupReplacement

  var id: String { rawValue }

  var label: String {
    switch self {
    case .fullLifecycle:
      return "Full Lifecycle"
    case .meetupReplacement:
      return "Meetup Replacement"
    }
  }

  var steps: [DebugFixtureStep] {
    switch self {
    case .fullLifecycle:
      return DebugFixtureData.fullLifecycle
    case .meetupReplacement:
      return DebugFixtureData.meetupReplacement
    }
  }
}

struct DebugFixtureStep: Identifiable {
  let name: String
  let snapshot: MeetupSnapshot?

  var id: String { name }
}

enum DebugNotificationDisposition: String {
  case delivered
  case suppressedPaused
  case suppressedSnoozed
  case suppressedQuietHours

  var label: String {
    switch self {
    case .delivered:
      return "Delivered"
    case .suppressedPaused:
      return "Paused"
    case .suppressedSnoozed:
      return "Snoozed"
    case .suppressedQuietHours:
      return "Quiet Hours"
    }
  }
}

struct DebugNotificationEntry: Identifiable, Hashable {
  let id = UUID()
  let createdAt: Date
  let disposition: DebugNotificationDisposition
  let event: MeetupChangeEvent
  let stepName: String?
}

@MainActor
@Observable
final class DebugHarness: MeetupSource, NotificationService {
  var sourceMode: DebugSourceMode = .liveCli
  var selectedScenario: DebugFixtureScenario = .fullLifecycle
  var currentStepIndex = 0
  var notificationLog: [DebugNotificationEntry] = []

  @ObservationIgnored private let snapshotStore: any SnapshotStore
  @ObservationIgnored private let liveSource: any MeetupSource
  @ObservationIgnored private let systemNotificationService: any NotificationService

  init(
    snapshotStore: any SnapshotStore,
    liveSource: any MeetupSource = CliMeetupSource(),
    systemNotificationService: any NotificationService = UserNotificationService()
  ) {
    self.snapshotStore = snapshotStore
    self.liveSource = liveSource
    self.systemNotificationService = systemNotificationService
  }

  var currentScenarioSteps: [DebugFixtureStep] {
    selectedScenario.steps
  }

  var currentStep: DebugFixtureStep {
    currentScenarioSteps[currentStepIndex]
  }

  var currentStepLabel: String {
    "\(currentStepIndex + 1) of \(currentScenarioSteps.count): \(currentStep.name)"
  }

  var canAdvanceScenario: Bool {
    currentStepIndex < currentScenarioSteps.count - 1
  }

  func fetchNextMeetup() async throws -> MeetupSnapshot? {
    switch sourceMode {
    case .liveCli:
      return try await liveSource.fetchNextMeetup()
    case .fixture:
      return currentStep.snapshot.map { snapshot in
        var updated = snapshot
        updated.lastSyncedAt = Date()
        return updated
      }
    }
  }

  func requestAuthorization() async {
    await systemNotificationService.requestAuthorization()
  }

  func notify(events: [MeetupChangeEvent], snapshot: MeetupSnapshot, preferences: AppPreferences) async {
    guard !events.isEmpty else {
      return
    }

    let disposition = notificationDisposition(now: Date(), preferences: preferences)
    let entries = events.map { event in
      DebugNotificationEntry(
        createdAt: Date(),
        disposition: disposition,
        event: event,
        stepName: sourceMode == .fixture ? currentStep.name : nil
      )
    }

    notificationLog.insert(contentsOf: entries, at: 0)

    if disposition == .delivered {
      await systemNotificationService.notify(events: events, snapshot: snapshot, preferences: preferences)
    }
  }

  func selectScenario(_ scenario: DebugFixtureScenario) {
    selectedScenario = scenario
    currentStepIndex = 0
  }

  func advanceScenario() {
    currentStepIndex = min(currentStepIndex + 1, currentScenarioSteps.count - 1)
  }

  func resetScenarioSession() {
    currentStepIndex = 0
    clearNotificationLog()
    clearPersistedState()
  }

  func clearNotificationLog() {
    notificationLog.removeAll()
  }

  func clearPersistedState() {
    try? snapshotStore.saveState(.empty)
  }

  private func notificationDisposition(now: Date, preferences: AppPreferences) -> DebugNotificationDisposition {
    if preferences.notificationsPaused {
      return .suppressedPaused
    }

    if preferences.isSnoozed {
      return .suppressedSnoozed
    }

    if preferences.quietHoursEnabled && preferences.quietHours.contains(now) {
      return .suppressedQuietHours
    }

    return .delivered
  }
}

private enum DebugFixtureData {
  static var fullLifecycle: [DebugFixtureStep] {
    let slug = "debug-june-meetup"
    return [
      DebugFixtureStep(
        name: "Draft announced",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: nil,
          endsAt: nil,
          venueName: nil,
          venueAddress: nil,
          rsvpURL: nil,
          seatsRemaining: 48,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "Date confirmed",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-20T06:00:00Z"),
          endsAt: date("2026-06-20T10:00:00Z"),
          venueName: nil,
          venueAddress: nil,
          rsvpURL: nil,
          seatsRemaining: 48,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "Location confirmed",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-20T06:00:00Z"),
          endsAt: date("2026-06-20T10:00:00Z"),
          venueName: "Spoon Consulting Offices",
          venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
          rsvpURL: nil,
          seatsRemaining: 48,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "RSVP opened",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-20T06:00:00Z"),
          endsAt: date("2026-06-20T10:00:00Z"),
          venueName: "Spoon Consulting Offices",
          venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
          rsvpURL: URL(string: "https://coders.mu/meetup/debug-june-meetup#rsvp"),
          seatsRemaining: 48,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "25-seat threshold crossed",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-20T06:00:00Z"),
          endsAt: date("2026-06-20T10:00:00Z"),
          venueName: "Spoon Consulting Offices",
          venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
          rsvpURL: URL(string: "https://coders.mu/meetup/debug-june-meetup#rsvp"),
          seatsRemaining: 24,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "10-seat threshold crossed",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-20T06:00:00Z"),
          endsAt: date("2026-06-20T10:00:00Z"),
          venueName: "Spoon Consulting Offices",
          venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
          rsvpURL: URL(string: "https://coders.mu/meetup/debug-june-meetup#rsvp"),
          seatsRemaining: 9,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "5-seat threshold crossed",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-20T06:00:00Z"),
          endsAt: date("2026-06-20T10:00:00Z"),
          venueName: "Spoon Consulting Offices",
          venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
          rsvpURL: URL(string: "https://coders.mu/meetup/debug-june-meetup#rsvp"),
          seatsRemaining: 4,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "Meetup postponed",
        snapshot: snapshot(
          slug: slug,
          title: "The June Meetup",
          description: "Debug fixture for notification testing.",
          startsAt: date("2026-06-27T06:00:00Z"),
          endsAt: date("2026-06-27T10:00:00Z"),
          venueName: "Spoon Consulting Offices",
          venueAddress: "Mountain View Vivea Business Park, Saint Pierre, Moka",
          rsvpURL: URL(string: "https://coders.mu/meetup/debug-june-meetup#rsvp"),
          seatsRemaining: 4,
          status: .postponed
        )
      )
    ]
  }

  static var meetupReplacement: [DebugFixtureStep] {
    [
      DebugFixtureStep(
        name: "Current meetup",
        snapshot: snapshot(
          slug: "debug-april-meetup",
          title: "The April Meetup",
          description: "Current meetup fixture.",
          startsAt: date("2026-04-18T06:00:00Z"),
          endsAt: date("2026-04-18T10:00:00Z"),
          venueName: nil,
          venueAddress: nil,
          rsvpURL: URL(string: "https://coders.mu/meetup/debug-april-meetup#rsvp"),
          seatsRemaining: 25,
          status: .upcoming
        )
      ),
      DebugFixtureStep(
        name: "New meetup published",
        snapshot: snapshot(
          slug: "debug-july-meetup",
          title: "The July Meetup",
          description: "A fresh meetup replaced the current one.",
          startsAt: nil,
          endsAt: nil,
          venueName: nil,
          venueAddress: nil,
          rsvpURL: nil,
          seatsRemaining: 60,
          status: .upcoming
        )
      )
    ]
  }

  private static func snapshot(
    slug: String,
    title: String,
    description: String?,
    startsAt: Date?,
    endsAt: Date?,
    venueName: String?,
    venueAddress: String?,
    rsvpURL: URL?,
    seatsRemaining: Int?,
    status: MeetupStatus
  ) -> MeetupSnapshot {
    MeetupSnapshot(
      slug: slug,
      title: title,
      description: description,
      startsAt: startsAt,
      endsAt: endsAt,
      venueName: venueName,
      venueAddress: venueAddress,
      meetupURL: URL(string: "https://coders.mu/meetup/\(slug)")!,
      rsvpURL: rsvpURL,
      seatsRemaining: seatsRemaining,
      status: status,
      lastSyncedAt: Date()
    )
  }

  private static func date(_ value: String) -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    if let date = formatter.date(from: value) {
      return date
    }

    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value) ?? Date()
  }
}
