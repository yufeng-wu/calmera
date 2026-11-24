import ExpoModulesCore

// Decorative material only; all accessible controls remain React Native siblings.
final class CalmeraGlassView: ExpoView {
  private let material = UIVisualEffectView()
  var cornerRadius: CGFloat = 0 { didSet { setNeedsLayout() } }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    overrideUserInterfaceStyle = .light
    isUserInteractionEnabled = false
    material.isUserInteractionEnabled = false
    addSubview(material)
    NotificationCenter.default.addObserver(self, selector: #selector(updateMaterial), name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil)
    updateMaterial()
  }

  @objc private func updateMaterial() {
    if UIAccessibility.isReduceTransparencyEnabled {
      material.effect = nil
      material.backgroundColor = UIColor.secondarySystemGroupedBackground
    } else {
      material.backgroundColor = .clear
      if #available(iOS 26.0, *) {
        material.effect = UIGlassEffect(style: .regular)
      } else {
        material.effect = UIBlurEffect(style: .systemMaterial)
      }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    material.frame = bounds
    material.layer.cornerRadius = cornerRadius > 0 ? min(cornerRadius, bounds.height / 2) : min(bounds.height / 2, 32)
    material.layer.cornerCurve = cornerRadius > 0 ? .continuous : .circular
    material.clipsToBounds = true
  }

  deinit { NotificationCenter.default.removeObserver(self) }
}
