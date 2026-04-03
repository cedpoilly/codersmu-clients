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
