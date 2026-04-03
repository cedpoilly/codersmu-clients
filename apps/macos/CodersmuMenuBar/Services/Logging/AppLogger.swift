import OSLog

enum AppLog {
  private static let subsystem = "mu.coders.CodersmuMenuBar"

  static let source = Logger(subsystem: subsystem, category: "source")
  static let persistence = Logger(subsystem: subsystem, category: "persistence")
  static let changeDetection = Logger(subsystem: subsystem, category: "changeDetection")
  static let notifications = Logger(subsystem: subsystem, category: "notifications")
  static let refresh = Logger(subsystem: subsystem, category: "refresh")
}
