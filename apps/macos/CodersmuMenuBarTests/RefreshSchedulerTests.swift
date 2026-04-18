import XCTest
@testable import CodersmuMenuBar

@MainActor
final class RefreshSchedulerTests: XCTestCase {
  private let calendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Indian/Mauritius")!
    return calendar
  }()

  func testUsesHourlyRefreshDuringBusinessHours() {
    let date = makeDate(hour: 10, minute: 0)
    XCTAssertEqual(RefreshScheduler.defaultInterval(at: date, calendar: calendar), .seconds(3600))
  }

  func testUsesSixHourRefreshOutsideBusinessHours() {
    let date = makeDate(hour: 20, minute: 0)
    XCTAssertEqual(RefreshScheduler.defaultInterval(at: date, calendar: calendar), .seconds(21600))
  }

  func testTransitionsIntoBusinessHoursWithoutOversleeping() {
    let date = makeDate(hour: 8, minute: 59)
    XCTAssertEqual(RefreshScheduler.defaultInterval(at: date, calendar: calendar), .seconds(60))
  }

  func testTransitionsOutOfBusinessHoursWithoutOversleeping() {
    let date = makeDate(hour: 17, minute: 30)
    XCTAssertEqual(RefreshScheduler.defaultInterval(at: date, calendar: calendar), .seconds(1800))
  }

  private func makeDate(hour: Int, minute: Int) -> Date {
    var components = DateComponents()
    components.year = 2026
    components.month = 4
    components.day = 20
    components.hour = hour
    components.minute = minute
    components.calendar = calendar
    components.timeZone = calendar.timeZone
    return calendar.date(from: components)!
  }
}
