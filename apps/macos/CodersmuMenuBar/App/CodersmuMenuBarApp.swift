import SwiftUI

@main
struct CodersmuMenuBarApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @State private var appModel: AppModel

  init() {
    let snapshotStore = ApplicationSupportSnapshotStore()
    let preferencesStore = AppPreferencesStore()
    let debugHarness = DebugHarness(snapshotStore: snapshotStore)
    let coordinator = RefreshCoordinator(
      source: debugHarness,
      snapshotStore: snapshotStore,
      changeDetector: ChangeDetector(),
      notificationService: debugHarness
    )

    let launchAtLoginManager = LaunchAtLoginManager()
    let scheduler = RefreshScheduler()

    let model = AppModel(
      coordinator: coordinator,
      scheduler: scheduler,
      preferencesStore: preferencesStore,
      launchAtLoginManager: launchAtLoginManager,
      debugHarness: debugHarness
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
        .frame(width: 520, height: 560)
    }
  }
}
