import SwiftUI

@main
struct CodersmuMenuBarApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @State private var appModel: AppModel

  init() {
    let source = CliMeetupSource()
    let snapshotStore = ApplicationSupportSnapshotStore()
    let preferencesStore = AppPreferencesStore()
    let notificationService = UserNotificationService()
    let coordinator = RefreshCoordinator(
      source: source,
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: notificationService
    )

    let launchAtLoginManager = LaunchAtLoginManager()
    let scheduler = RefreshScheduler()

    let model = AppModel(
      coordinator: coordinator,
      scheduler: scheduler,
      preferencesStore: preferencesStore,
      launchAtLoginManager: launchAtLoginManager
    )

    scheduler.onTick = { [weak model] in
      guard let model else {
        return
      }

      AppLog.refresh.debug("Scheduled refresh tick fired.")
      await model.refresh(trigger: .scheduled)
    }

    _appModel = State(initialValue: model)
    AppDelegate.onDidFinishLaunching = {
      Task { @MainActor in
        await model.start()
      }
    }
  }

  var body: some Scene {
    MenuBarExtra {
      MenuBarRootView(appModel: appModel)
        .frame(width: 380)
    } label: {
      MenuBarLabelView(state: appModel.menuBarLabelState)
    }
    .menuBarExtraStyle(.window)

    Settings {
      SettingsView(appModel: appModel)
        .frame(width: 420, height: 320)
    }
  }
}
