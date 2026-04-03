import SwiftUI

struct MenuBarLabelView: View {
  let state: MenuBarLabelState

  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      CodersmuBrandMarkView()
        .frame(width: 18, height: 18)

      switch state {
      case .normal:
        EmptyView()
      case .refreshing:
        StatusBadge(symbolName: "arrow.triangle.2.circlepath")
      case .muted:
        StatusBadge(symbolName: "bell.slash.fill")
      case .error:
        StatusBadge(symbolName: "exclamationmark.circle.fill")
      }
    }
    .frame(width: 20, height: 18)
    .accessibilityLabel(state.accessibilityLabel)
  }
}

private struct StatusBadge: View {
  let symbolName: String

  var body: some View {
    Image(systemName: symbolName)
      .font(.system(size: 8, weight: .bold))
      .padding(1)
      .background(.regularMaterial, in: Circle())
      .offset(x: 2, y: 1)
  }
}
