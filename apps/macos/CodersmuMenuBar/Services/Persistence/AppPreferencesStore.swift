import Foundation

struct AppPreferencesStore {
  private let userDefaults: UserDefaults
  private let storageKey = "mu.coders.CodersmuMenuBar.preferences"

  init(userDefaults: UserDefaults = .standard) {
    self.userDefaults = userDefaults
  }

  func load() -> AppPreferences {
    guard let data = userDefaults.data(forKey: storageKey),
          let preferences = try? JSONDecoder().decode(AppPreferences.self, from: data)
    else {
      return .default
    }

    return preferences
  }

  func save(_ preferences: AppPreferences) {
    guard let data = try? JSONEncoder().encode(preferences) else {
      return
    }

    userDefaults.set(data, forKey: storageKey)
  }
}
