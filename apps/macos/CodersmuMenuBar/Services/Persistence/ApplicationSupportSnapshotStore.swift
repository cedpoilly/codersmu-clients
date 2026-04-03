import Foundation

struct ApplicationSupportSnapshotStore: SnapshotStore {
  private let fileManager: FileManager

  init(fileManager: FileManager = .default) {
    self.fileManager = fileManager
  }

  func loadState() throws -> PersistedAppState {
    let fileURL = try stateFileURL()

    guard fileManager.fileExists(atPath: fileURL.path) else {
      return .empty
    }

    let data = try Data(contentsOf: fileURL)
    return try JSONDecoder.iso8601.decode(PersistedAppState.self, from: data)
  }

  func saveState(_ state: PersistedAppState) throws {
    let directoryURL = try applicationSupportDirectory()
    try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true, attributes: nil)

    let data = try JSONEncoder.prettyPrinted.encode(state)
    try data.write(to: directoryURL.appendingPathComponent("state.json"), options: .atomic)
  }

  private func applicationSupportDirectory() throws -> URL {
    try fileManager
      .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("CodersmuMenuBar", isDirectory: true)
  }

  private func stateFileURL() throws -> URL {
    let directoryURL = try applicationSupportDirectory()
    return directoryURL.appendingPathComponent("state.json")
  }
}

private extension JSONEncoder {
  static var prettyPrinted: JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    encoder.dateEncodingStrategy = .iso8601
    return encoder
  }
}

private extension JSONDecoder {
  static var iso8601: JSONDecoder {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return decoder
  }
}
