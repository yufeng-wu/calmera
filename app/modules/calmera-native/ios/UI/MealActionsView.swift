import ExpoModulesCore

// Real UIKit glass actions own highlighting and material adaptation.
// Gesture Handler drives this native material with its UI-thread progress.
// Droplet geometry converges to zero while the native material stays assigned.
final class CalmeraMealActionsView: ExpoView {
  let onAction = EventDispatcher()
  let onMetrics = EventDispatcher()
  var buttonWidth: CGFloat = 72
  var buttonHeight: CGFloat = 70
  var effectOutset: CGFloat = 40
  var actionsVisible = false
  var reportMetrics = false
  var revealProgress: CGFloat = 0 { didSet { renderProgress() } }
  private let container = UIVisualEffectView(effect: nil)
  private var materials: [UIVisualEffectView] = []
  private var buttons: [UIButton] = []
  private var labels: [UILabel] = []
  private var configurationKey = ""
  private var lastMetrics: [String: Double] = [:]
  private var lastProgressBucket = -1
  var previewPalette = "tangerine"

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    clipsToBounds = false
    overrideUserInterfaceStyle = .light
    container.backgroundColor = .clear
    container.clipsToBounds = false
    container.contentView.clipsToBounds = false
    addSubview(container)
    // The swipe rail carries only Delete; Edit lives in the expanded card.
    for _ in 0..<1 {
      let material = UIVisualEffectView(effect: nil)
      material.clipsToBounds = false
      material.layer.cornerRadius = 28
      material.layer.cornerCurve = .continuous
      if #available(iOS 26.0, *) { material.cornerConfiguration = .capsule(maximumRadius: 28) }
      let button = UIButton(type: .system)
      button.configuration = .plain()
      button.accessibilityLabel = "Delete meal"
      button.addAction(UIAction(title: "Delete", attributes: .destructive) { [weak self] _ in
          self?.onAction(["action": "delete"])
        }, for: .touchUpInside)
      let label = UILabel()
      label.text = "Delete"
      label.adjustsFontForContentSizeCategory = true
      label.numberOfLines = 1
      label.textAlignment = .center
      label.isAccessibilityElement = false
      label.isUserInteractionEnabled = false
      button.addSubview(label)
      material.contentView.addSubview(button)
      container.contentView.addSubview(material)
      materials.append(material); labels.append(label); buttons.append(button)
    }
    for name in [UIContentSizeCategory.didChangeNotification,
      UIAccessibility.reduceTransparencyStatusDidChangeNotification,
      UIAccessibility.darkerSystemColorsStatusDidChangeNotification,
      UIAccessibility.reduceMotionStatusDidChangeNotification] {
      NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: name, object: nil)
    }
    updateControls()
  }

  @objc private func accessibilityChanged() {
    configurationKey = ""
    updateControls()
  }

  func updateControls() {
    let opaque = UIAccessibility.isReduceTransparencyEnabled
    let key = traitCollection.preferredContentSizeCategory.rawValue + "-\(opaque)-\(UIAccessibility.isDarkerSystemColorsEnabled)-\(previewPalette)"
    if key != configurationKey {
      configurationKey = key
      if #available(iOS 26.0, *), !opaque {
        let group = UIGlassContainerEffect()
        // Separate at the final 8pt gap; merge naturally while retracting.
        group.spacing = 6
        container.effect = group
      } else { container.effect = nil }
      let font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .medium), compatibleWith: traitCollection)
      for (index, material) in materials.enumerated() {
        applyMaterial(material, opaque: opaque)
        material.backgroundColor = opaque ? .secondarySystemBackground : .clear
        let color: UIColor = .systemRed
        buttons[index].tintColor = color
        labels[index].font = font
        labels[index].textColor = color
      }
    }
    setNeedsLayout()
    renderProgress()
  }

  // Keep the material mounted through repeated reveals. Droplet geometry owns visibility; do not fade the effect or
  // depend on a paused nil-to-glass animation for a fully open action.
  private func applyMaterial(_ material: UIVisualEffectView, opaque: Bool) {
    if opaque { material.effect = nil }
    else if #available(iOS 26.0, *) {
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = true
      material.effect = glass
    } else { material.effect = UIBlurEffect(style: .systemMaterial) }
  }

  // Glass set up while the row was off screen or under a fading ancestor, as when a first meal's row arrives
  // mid-animation, can stay blank. Each reveal starts from a hidden droplet, so applying it afresh then can't be seen.
  private func refreshGlass() {
    let opaque = UIAccessibility.isReduceTransparencyEnabled
    if #available(iOS 26.0, *), !opaque {
      let group = UIGlassContainerEffect()
      group.spacing = 6
      container.effect = group
    }
    for material in materials { applyMaterial(material, opaque: opaque) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    container.frame = bounds
    renderProgress()
  }

  private func renderProgress() {
    guard materials.count == 1 else { return }
    let p = min(1, max(0, revealProgress))
    let fullHeight = max(0, bounds.height - 2 * effectOutset)
    let anchor = effectOutset + buttonWidth
    let visibleWidth = buttonWidth * p
    let visibleHeight = fullHeight * p
    let labelPhase = min(1, max(0, (p - 0.45) / 0.45))
    let labelOpacity = labelPhase * labelPhase * (3 - 2 * labelPhase)
    // The original UI-thread progress still drives the same droplet geometry;
    // the actual glass effect and native shadow are never scrubbed or faded.
    if p > 0, materials.allSatisfy({ $0.isHidden }), window != nil { refreshGlass() }
    for (index, material) in materials.enumerated() {
      // The droplet grows from the rail's right-edge seed.
      let originX = anchor - visibleWidth
      material.isHidden = p == 0
      material.frame = CGRect(x: originX,
        y: effectOutset + (fullHeight - visibleHeight) / 2,
        width: visibleWidth, height: visibleHeight)
      buttons[index].frame = material.bounds
      buttons[index].isUserInteractionEnabled = actionsVisible && p > 0.95
      buttons[index].accessibilityElementsHidden = !(actionsVisible && p > 0.95)
      labels[index].frame = CGRect(x: (visibleWidth - buttonWidth) / 2 + 4,
        y: 0, width: max(0, buttonWidth - 8), height: visibleHeight)
      // Content may fade; the glass and its shadow retain full ancestor alpha.
      labels[index].alpha = labelOpacity
    }
    isUserInteractionEnabled = actionsVisible && p > 0.95
    accessibilityElementsHidden = !isUserInteractionEnabled
    if reportMetrics {
      var glass = 0.0
      if #available(iOS 26.0, *), !UIAccessibility.isReduceTransparencyEnabled { glass = 1 }
      let bucket = Int((p * 10).rounded())
      let checkpoint = abs(p * 4 - (p * 4).rounded()) < 0.00001
      let metrics: [String: Double] = ["buttonWidth": Double(buttonWidth), "buttonHeight": Double(fullHeight),
        "labelSize": Double(labels.first?.font.pointSize ?? 0), "symbolSize": 0,
        "usesNativeGlass": glass, "opaqueFallback": UIAccessibility.isReduceTransparencyEnabled ? 1 : 0,
        "revealProgress": Double((p * 1000).rounded() / 1000), "renderedWidth": Double((visibleWidth * 10).rounded() / 10),
        "materialAssignedCount": Double(materials.filter { $0.effect != nil }.count),
        "visibleMaterialCount": Double(materials.filter { !$0.isHidden && $0.window != nil
          && $0.bounds.width > 0 && $0.bounds.height > 0 }.count), "sharedGlassContainer": glass]
      // Geometry-only fixture diagnostics, emitted at most once per tenth step.
      if bucket != lastProgressBucket || (checkpoint && lastMetrics["revealProgress"] != metrics["revealProgress"]) ||
        lastMetrics["buttonWidth"] != metrics["buttonWidth"] || lastMetrics["buttonHeight"] != metrics["buttonHeight"] {
        lastProgressBucket = bucket
        lastMetrics = metrics
        onMetrics(metrics)
      }
    }
  }

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    actionsVisible && revealProgress > 0.95 && materials.contains { $0.frame.contains(point) }
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }
}
