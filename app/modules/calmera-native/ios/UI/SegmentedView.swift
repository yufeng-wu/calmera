import ExpoModulesCore

// One row of choices. On iOS 26 UIKit draws this as Liquid Glass with a
// sliding glass thumb; React only supplies the options and the selection.
final class CalmeraSegmentedView: ExpoView {
  let onSelect = EventDispatcher()
  var options: [String] = []
  var symbols: [String] = []
  var selected = ""
  var controlLabel = ""
  var controlDisabled = false
  // Segments sized to their titles, for a row where one label is much longer.
  var fitContent = false
  private let control = UISegmentedControl()
  private var shownKey = ""
  private let ink = UIColor(red: 74/255, green: 52/255, blue: 40/255, alpha: 1)
  private let accent = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    overrideUserInterfaceStyle = .light
    control.selectedSegmentTintColor = .white
    // Equal-width segments (UIKit's default) keep the row symmetric.
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
    addSubview(control)
    NotificationCenter.default.addObserver(self, selector: #selector(textSizeChanged),
      name: UIContentSizeCategory.didChangeNotification, object: nil)
  }
  func updateControl() {
    let index = options.firstIndex(of: selected) ?? UISegmentedControl.noSegment
    let key = options.joined(separator: "|") + "#" + symbols.joined(separator: "|")
    if key != shownKey {
      shownKey = key
      control.removeAllSegments()
      for (position, option) in options.enumerated() { control.insertSegment(withTitle: option, at: position, animated: false) }
    }
    if control.selectedSegmentIndex != index { control.selectedSegmentIndex = index }
    control.isEnabled = !controlDisabled
    control.apportionsSegmentWidthsByContent = fitContent
    control.accessibilityLabel = controlLabel
    applyContent()
    setNeedsLayout()
  }
  private var titleFont: UIFont {
    UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 13, weight: .semibold), compatibleWith: traitCollection)
  }
  // A segment holds either an image or a title, so a symbol sits above its title
  // in one drawn image, coloured for its own state.
  private func applyContent() {
    control.setTitleTextAttributes([.font: titleFont, .foregroundColor: ink], for: .normal)
    control.setTitleTextAttributes([.font: titleFont, .foregroundColor: accent], for: .selected)
    guard symbols.count == options.count else { return }
    for (position, option) in options.enumerated() {
      let image = segmentImage(symbol: symbols[position], title: option, color: position == control.selectedSegmentIndex ? accent : ink)
      image.accessibilityLabel = option
      control.setImage(image, forSegmentAt: position)
    }
  }
  private func segmentImage(symbol: String, title: String, color: UIColor) -> UIImage {
    let font = titleFont
    let symbolFont = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 16, weight: .semibold), compatibleWith: traitCollection)
    let glyph = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(font: symbolFont))?
      .withTintColor(color, renderingMode: .alwaysOriginal)
    let text = NSAttributedString(string: title, attributes: [.font: font, .foregroundColor: color])
    let textSize = text.size()
    // Every symbol is scaled to fit one fixed box, so the four read at the same size
    // and all titles share one baseline.
    let box = CGSize(width: ceil(symbolFont.pointSize * 1.35), height: ceil(symbolFont.pointSize * 1.2))
    let raw = glyph?.size ?? .zero
    let scale = raw.width > 0 && raw.height > 0 ? min(box.width / raw.width, box.height / raw.height) : 0
    let glyphSize = CGSize(width: raw.width * scale, height: raw.height * scale)
    let spacing: CGFloat = 3
    let size = CGSize(width: ceil(max(textSize.width, box.width)), height: ceil(box.height + spacing + textSize.height))
    let image = UIGraphicsImageRenderer(size: size).image { _ in
      glyph?.draw(in: CGRect(x: (size.width - glyphSize.width) / 2, y: (box.height - glyphSize.height) / 2,
        width: glyphSize.width, height: glyphSize.height))
      text.draw(at: CGPoint(x: (size.width - textSize.width) / 2, y: box.height + spacing))
    }
    return image.withRenderingMode(.alwaysOriginal)
  }
  @objc private func textSizeChanged() { applyContent(); setNeedsLayout() }
  override func layoutSubviews() {
    super.layoutSubviews()
    control.frame = bounds
  }
  @objc private func changed() {
    let index = control.selectedSegmentIndex
    guard index >= 0, index < options.count else { return }
    selected = options[index]
    applyContent()
    onSelect(["value": options[index]])
  }
  deinit { NotificationCenter.default.removeObserver(self) }
}
