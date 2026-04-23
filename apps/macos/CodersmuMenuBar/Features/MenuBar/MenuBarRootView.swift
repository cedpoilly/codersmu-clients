import AppKit
import Observation
import SwiftUI

struct MenuBarRootView: View {
  private enum FocusTarget: Hashable {
    case refreshButton
  }

  @Bindable var appModel: AppModel
  @Environment(\.openSettings) private var openSettings
  @State private var isShowingAgenda = false
  @State private var isShowingQuitConfirmation = false
  @FocusState private var focusedTarget: FocusTarget?

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 4) {
          Text("Coders.mu")
            .font(.headline)
          Text("Next meetup monitor")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Spacer()

        Text(appModel.snapshot?.status.label ?? "No meetup")
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .padding(.vertical, 4)
          .background(.quaternary, in: Capsule())
      }

      Divider()

      NextMeetupSummaryView(
        snapshot: appModel.snapshot,
        agendaItems: agendaItems,
        isShowingAgenda: $isShowingAgenda
      )

      Divider()

      MenuBarStatusSectionView(
        refreshState: appModel.refreshState,
        lastChange: appModel.lastChange,
        lastRefreshAt: appModel.lastRefreshAt,
        isNotificationsMuted: appModel.isNotificationsEffectivelyMuted
      )

      Divider()

      VStack(alignment: .leading, spacing: 8) {
        if let meetupURL = appModel.snapshot?.meetupURL {
          Link(destination: meetupURL) {
            Label("Open Meetup Page", systemImage: "arrow.up.forward.square")
          }
        }

        if let rsvpURL = appModel.snapshot?.rsvpURL {
          Link(destination: rsvpURL) {
            Label("Open RSVP", systemImage: "ticket")
          }
        }

        if let calendarURL = appModel.snapshot?.googleCalendarURL {
          Link(destination: calendarURL) {
            Label("Add to Calendar", systemImage: "calendar")
          }
        }
      }
      .buttonStyle(.link)

      Divider()

      HStack {
        Button(appModel.isRefreshing ? "Refreshing…" : "Refresh Now") {
          Task {
            await appModel.refresh()
          }
        }
        .focusable()
        .focused($focusedTarget, equals: .refreshButton)
        .disabled(appModel.isRefreshing)

        if appModel.isRefreshing {
          ProgressView()
            .controlSize(.small)
        }

        Menu("Notifications") {
          if appModel.preferences.isSnoozed {
            Button("Resume Now") {
              appModel.clearSnooze()
            }
          } else {
            Button("Snooze for 1 Hour") {
              appModel.snoozeForOneHour()
            }
            Button("Snooze Until Tomorrow 08:00") {
              appModel.snoozeUntilTomorrowMorning()
            }
          }

          Divider()

          Button(appModel.preferences.notificationsPaused ? "Resume Notifications" : "Pause Notifications") {
            appModel.setNotificationsPaused(!appModel.preferences.notificationsPaused)
          }
        }

        Spacer()

        Button {
          NSApp.activate(ignoringOtherApps: true)
          openSettings()
        } label: {
          Image(systemName: "gearshape")
        }
        .buttonStyle(.plain)
        .help("Open Settings")

        Button {
          isShowingQuitConfirmation = true
        } label: {
          Image(systemName: "power")
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
        .help("Quit Coders.mu")
      }

      if isShowingQuitConfirmation {
        Divider()

        VStack(alignment: .leading, spacing: 10) {
          Text("Quit Coders.mu?")
            .font(.headline)

          Text("Notifications and background refresh will stop until you open the app again.")
            .font(.caption)
            .foregroundStyle(.secondary)

          HStack {
            Button("Cancel") {
              isShowingQuitConfirmation = false
            }

            Spacer()

            Button("Quit", role: .destructive) {
              NSApp.terminate(nil)
            }
          }
        }
      }
    }
    .padding(16)
    .onAppear {
      DispatchQueue.main.async {
        focusedTarget = .refreshButton
      }
    }
    .onDisappear {
      focusedTarget = nil
    }
  }

  private var agendaItems: [MeetupAgendaItem] {
    if let structuredItems = appModel.snapshot?.agendaItems, !structuredItems.isEmpty {
      return structuredItems
    }

    guard let summary = appModel.snapshot?.agendaSummary else {
      return []
    }

    return summary
      .split(separator: "|")
      .enumerated()
      .compactMap { index, title -> MeetupAgendaItem? in
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
          return nil
        }

        return MeetupAgendaItem(
          id: "summary-\(index)",
          title: trimmedTitle,
          description: nil,
          durationMinutes: nil,
          speakers: []
        )
      }
  }
}
