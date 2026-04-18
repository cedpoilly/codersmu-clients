import Foundation

@MainActor
final class RefreshScheduler {
  static let businessHours: Range<Int> = 9..<18
  static let businessHoursInterval: Duration = .seconds(3600)
  static let offHoursInterval: Duration = .seconds(21600)

  private let intervalProvider: @MainActor () -> Duration
  private var task: Task<Void, Never>?
  var onTick: (@MainActor () async -> Void)?

  init(
    intervalProvider: @escaping @MainActor () -> Duration = { RefreshScheduler.defaultInterval(at: Date()) },
    onTick: (@MainActor () async -> Void)? = nil
  ) {
    self.intervalProvider = intervalProvider
    self.onTick = onTick
  }

  static func defaultInterval(at date: Date, calendar: Calendar = .current) -> Duration {
    let hour = calendar.component(.hour, from: date)
    let defaultSeconds = businessHours.contains(hour) ? 3600.0 : 21600.0

    guard let nextBoundary = nextScheduleBoundary(after: date, calendar: calendar) else {
      return .seconds(defaultSeconds)
    }

    let secondsUntilBoundary = max(0, nextBoundary.timeIntervalSince(date))
    return .seconds(min(defaultSeconds, secondsUntilBoundary))
  }

  private static func nextScheduleBoundary(after date: Date, calendar: Calendar) -> Date? {
    let hour = calendar.component(.hour, from: date)
    let boundaryHour = businessHours.contains(hour) ? businessHours.upperBound : businessHours.lowerBound

    return calendar.nextDate(
      after: date,
      matching: DateComponents(hour: boundaryHour, minute: 0, second: 0),
      matchingPolicy: .nextTime,
      repeatedTimePolicy: .first,
      direction: .forward
    )
  }

  func start() {
    guard task == nil else {
      return
    }

    task = Task { [weak self] in
      while !Task.isCancelled {
        guard let self else {
          return
        }

        try? await Task.sleep(for: self.intervalProvider())
        if Task.isCancelled {
          break
        }

        await self.onTick?()
      }
    }
  }

  func stop() {
    task?.cancel()
    task = nil
  }
}
