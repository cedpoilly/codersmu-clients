import Observation
import SwiftUI

struct SettingsView: View {
  @Bindable var appModel: AppModel

  private var showsDeveloperControls: Bool {
#if DEBUG
    true
#else
    ProcessInfo.processInfo.environment["CODERSMU_DEV_CONTROLS"] == "1"
#endif
  }

  var body: some View {
    Form {
      Section("Notifications") {
        Toggle(
          "Pause notifications",
          isOn: Binding(
            get: { appModel.preferences.notificationsPaused },
            set: { appModel.setNotificationsPaused($0) }
          )
        )

        Toggle(
          "Enable quiet hours",
          isOn: Binding(
            get: { appModel.preferences.quietHoursEnabled },
            set: { appModel.setQuietHoursEnabled($0) }
          )
        )

        Picker(
          "Quiet hours start",
          selection: Binding(
            get: { appModel.preferences.quietHours.startHour },
            set: { appModel.setQuietHoursStartHour($0) }
          )
        ) {
          ForEach(0..<24, id: \.self) { hour in
            Text(hourLabel(for: hour)).tag(hour)
          }
        }
        .disabled(!appModel.preferences.quietHoursEnabled)

        Picker(
          "Quiet hours end",
          selection: Binding(
            get: { appModel.preferences.quietHours.endHour },
            set: { appModel.setQuietHoursEndHour($0) }
          )
        ) {
          ForEach(0..<24, id: \.self) { hour in
            Text(hourLabel(for: hour)).tag(hour)
          }
        }
        .disabled(!appModel.preferences.quietHoursEnabled)

        HStack {
          Text("Snooze")
          Spacer()
          Button("1 Hour") {
            appModel.snoozeForOneHour()
          }
          Button("Tomorrow 08:00") {
            appModel.snoozeUntilTomorrowMorning()
          }

          if appModel.preferences.isSnoozed {
            Button("Resume") {
              appModel.clearSnooze()
            }
          }
        }

        Text("Status: \(appModel.notificationDebugState.summary)")
          .font(.caption)
          .foregroundStyle(.secondary)

        if appModel.notificationDebugState.authorizationState == .notDetermined {
          Button("Request Notification Permission") {
            Task {
              await appModel.requestNotificationPermission()
            }
          }
        }
      }

      Section("App") {
        Toggle(
          "Launch at login",
          isOn: Binding(
            get: { appModel.preferences.launchAtLoginEnabled },
            set: { appModel.setLaunchAtLoginEnabled($0) }
          )
        )

        if let errorMessage = appModel.launchAtLoginErrorMessage {
          Text(errorMessage)
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        HStack(spacing: 8) {
          if appModel.isRefreshing {
            ProgressView()
              .controlSize(.small)
          } else {
            Image(systemName: appModel.refreshStateIconName)
              .foregroundStyle(appModel.refreshStateTint)
          }

          Text(appModel.refreshStatusText)
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        Button(appModel.isRefreshing ? "Refreshing…" : "Refresh Now") {
          Task {
            await appModel.refresh()
          }
        }
        .disabled(appModel.isRefreshing)
      }

      if showsDeveloperControls {
        Section("Developer") {
          Button("Refresh Notification Status") {
            Task {
              await appModel.refreshNotificationDebugState()
            }
          }
          .disabled(appModel.isRefreshing)

          Button("Send Test Notification") {
            Task {
              await appModel.sendTestNotification()
            }
          }
          .disabled(appModel.isRefreshing)

          if let notificationDebugMessage = appModel.notificationDebugMessage {
            Text(notificationDebugMessage)
              .font(.caption)
              .foregroundStyle(.secondary)
          }

          Button(appModel.isRefreshing ? "Refreshing…" : "Trigger Scheduled Refresh") {
            Task {
              await appModel.refresh(trigger: .scheduled)
            }
          }
          .help("Runs the scheduled refresh path immediately without waiting for the next timer tick.")
          .disabled(appModel.isRefreshing)

          ForEach(DeveloperInjectedEvent.allCases) { event in
            Button(event.buttonTitle) {
              Task {
                await appModel.simulateDeveloperEvent(event)
              }
            }
            .disabled(appModel.isRefreshing)
          }
        }
      }
    }
    .formStyle(.grouped)
    .padding(18)
  }

  private func hourLabel(for hour: Int) -> String {
    var components = DateComponents()
    components.hour = hour
    components.minute = 0

    let calendar = Calendar.current
    let date = calendar.date(from: components) ?? Date()
    return date.formatted(date: .omitted, time: .shortened)
  }
}

private extension AppModel {
  var refreshStateIconName: String {
    switch refreshState {
    case .idle:
      return "checkmark.circle.fill"
    case .refreshing:
      return "arrow.triangle.2.circlepath"
    case .failed:
      return "exclamationmark.triangle.fill"
    }
  }

  var refreshStateTint: Color {
    switch refreshState {
    case .idle:
      return .green
    case .refreshing:
      return .secondary
    case .failed:
      return .orange
    }
  }
}
