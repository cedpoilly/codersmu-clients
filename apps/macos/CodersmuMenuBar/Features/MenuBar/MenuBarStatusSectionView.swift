import SwiftUI

struct MenuBarStatusSectionView: View {
  let refreshState: RefreshState
  let lastChange: MeetupChangeEvent?
  let lastRefreshAt: Date?
  let isNotificationsMuted: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if let lastChange {
        Text(lastChange.summary)
          .font(.subheadline.weight(.medium))
      } else {
        Text("No new changes detected yet.")
          .font(.subheadline)
      }

      Text(refreshDescription)
        .font(.caption)
        .foregroundStyle(.secondary)

      if isNotificationsMuted {
        Label("Notifications are paused or snoozed.", systemImage: "bell.slash")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }

  private var refreshDescription: String {
    switch refreshState {
    case .idle:
      guard let lastRefreshAt else {
        return "Waiting for the first refresh."
      }

      return "Last updated \(lastRefreshAt.formatted(date: .abbreviated, time: .shortened))."
    case .refreshing:
      return "Refreshing meetup data…"
    case .failed(let message):
      return message
    }
  }
}
