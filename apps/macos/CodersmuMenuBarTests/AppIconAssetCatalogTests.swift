import XCTest

final class AppIconAssetCatalogTests: XCTestCase {
  func testAppIconCatalogIncludesAllMacOSSlots() throws {
    let iconSetURL = try appIconSetURL()
    let contentsURL = iconSetURL.appendingPathComponent("Contents.json")
    let data = try Data(contentsOf: contentsURL)
    let catalog = try JSONDecoder().decode(AppIconCatalog.self, from: data)

    XCTAssertEqual(catalog.images.count, 10)

    let expectedFilenames = Set([
      "icon_16x16.png",
      "icon_16x16@2x.png",
      "icon_32x32.png",
      "icon_32x32@2x.png",
      "icon_128x128.png",
      "icon_128x128@2x.png",
      "icon_256x256.png",
      "icon_256x256@2x.png",
      "icon_512x512.png",
      "icon_512x512@2x.png",
    ])

    XCTAssertEqual(Set(catalog.images.compactMap(\.filename)), expectedFilenames)

    for filename in expectedFilenames {
      let fileURL = iconSetURL.appendingPathComponent(filename)
      XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path), "Missing \(filename)")
    }
  }

  private func appIconSetURL() throws -> URL {
    let testFileURL = URL(fileURLWithPath: #filePath)
    let appIconSetURL = testFileURL
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("CodersmuMenuBar/Assets.xcassets/AppIcon.appiconset", isDirectory: true)

    guard FileManager.default.fileExists(atPath: appIconSetURL.path) else {
      throw XCTSkip("App icon set not found at \(appIconSetURL.path)")
    }

    return appIconSetURL
  }
}

private struct AppIconCatalog: Decodable {
  let images: [AppIconImage]
}

private struct AppIconImage: Decodable {
  let filename: String?
}
