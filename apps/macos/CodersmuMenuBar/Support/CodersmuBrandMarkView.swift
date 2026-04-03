import AppKit
import SwiftUI

struct CodersmuBrandMarkView: View {
  private static let icon = CodersmuBrandMarkIcon.make()

  var body: some View {
    Image(nsImage: Self.icon)
      .renderingMode(.template)
      .resizable()
      .aspectRatio(1, contentMode: .fit)
      .foregroundStyle(.primary)
  }
}

private enum CodersmuBrandMarkIcon {
  static func make(size: CGFloat = 18) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
      guard let context = NSGraphicsContext.current?.cgContext else {
        return false
      }

      let inset = size * 0.08
      let iconRect = rect.insetBy(dx: inset, dy: inset)

      context.setFillColor(NSColor.black.cgColor)
      context.fillEllipse(in: iconRect)

      context.setBlendMode(.clear)
      context.setStrokeColor(NSColor.clear.cgColor)
      context.setLineWidth(size * 0.17)
      context.setLineCap(.round)
      context.setLineJoin(.round)
      context.addPath(compactGlyphPath(in: iconRect))
      context.strokePath()

      return true
    }

    image.isTemplate = true
    return image
  }

  private static func compactGlyphPath(in rect: CGRect) -> CGPath {
    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(
        x: rect.minX + (rect.width * x),
        y: rect.minY + (rect.height * y)
      )
    }

    let path = CGMutablePath()
    path.move(to: point(0.34, 0.25))
    path.addLine(to: point(0.62, 0.50))
    path.addLine(to: point(0.34, 0.75))

    return path
  }
}
