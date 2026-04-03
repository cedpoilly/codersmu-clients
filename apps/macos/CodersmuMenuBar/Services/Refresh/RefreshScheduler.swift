import Foundation

@MainActor
final class RefreshScheduler {
  private let interval: Duration
  private var task: Task<Void, Never>?
  var onTick: (@MainActor () async -> Void)?

  init(interval: Duration = .seconds(1800), onTick: (@MainActor () async -> Void)? = nil) {
    self.interval = interval
    self.onTick = onTick
  }

  func start() {
    guard task == nil else {
      return
    }

    task = Task { [interval, weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(for: interval)
        if Task.isCancelled {
          break
        }

        guard let self else {
          return
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
