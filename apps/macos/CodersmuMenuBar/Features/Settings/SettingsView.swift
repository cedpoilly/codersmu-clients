import Observation
import SwiftUI

struct SettingsView: View {
  @Bindable var appModel: AppModel

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

        Button("Refresh Now") {
          Task {
            await appModel.refresh()
          }
        }
      }

      Section("Debug Update Testing") {
        Picker(
          "Source",
          selection: Binding(
            get: { appModel.debugHarness.sourceMode },
            set: { mode in
              Task {
                await appModel.selectDebugSourceMode(mode)
              }
            }
          )
        ) {
          ForEach(DebugSourceMode.allCases) { mode in
            Text(mode.label).tag(mode)
          }
        }

        if appModel.debugHarness.sourceMode == .fixture {
          Picker(
            "Scenario",
            selection: Binding(
              get: { appModel.debugHarness.selectedScenario },
              set: { scenario in
                Task {
                  await appModel.selectDebugScenario(scenario)
                }
              }
            )
          ) {
            ForEach(DebugFixtureScenario.allCases) { scenario in
              Text(scenario.label).tag(scenario)
            }
          }

          VStack(alignment: .leading, spacing: 4) {
            Text("Current fixture step")
              .font(.caption)
              .foregroundStyle(.secondary)
            Text(appModel.debugHarness.currentStepLabel)
              .font(.subheadline.weight(.medium))
          }

          HStack {
            Button("Advance + Refresh") {
              Task {
                await appModel.advanceDebugScenario()
              }
            }
            .disabled(!appModel.debugHarness.canAdvanceScenario)

            Button("Replay from Start") {
              Task {
                await appModel.replayDebugScenario()
              }
            }
          }
        }

        HStack {
          Button("Reset Delivery State") {
            Task {
              await appModel.clearDebugPersistedState()
            }
          }

          Button("Clear Notification Log") {
            appModel.clearDebugNotificationLog()
          }
        }

        VStack(alignment: .leading, spacing: 8) {
          Text("Recorded notification attempts")
            .font(.caption)
            .foregroundStyle(.secondary)

          if appModel.debugHarness.notificationLog.isEmpty {
            Text("No notification attempts recorded yet.")
              .font(.subheadline)
              .foregroundStyle(.secondary)
          } else {
            ForEach(Array(appModel.debugHarness.notificationLog.prefix(6))) { entry in
              VStack(alignment: .leading, spacing: 2) {
                HStack {
                  Text(entry.disposition.label)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(.quaternary, in: Capsule())

                  if let stepName = entry.stepName {
                    Text(stepName)
                      .font(.caption)
                      .foregroundStyle(.secondary)
                  }

                  Spacer()

                  Text(entry.createdAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Text(entry.event.summary)
                  .font(.subheadline)
              }
              .padding(.vertical, 4)
            }
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
