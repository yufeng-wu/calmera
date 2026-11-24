import ExpoModulesCore

// Standard UIKit glass buttons, shared by custom-header form screens.
// No opacity/scale animation around material; UIKit supplies its own press effect.
final class CalmeraFormButtonView: ExpoView {
  let onPress = EventDispatcher()
  let onMetrics = EventDispatcher()
  var metricsEnabled = false
  private var lastMetrics: [String: Double] = [:]
  var buttonTitle = ""
  var symbol = ""
  var buttonRole = "default"
  var buttonLabel = ""
  var buttonDisabled = false
  var loading = false
  private let button = UIButton(type: .system)
  private let tint = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
  private var configurationKey = ""

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    clipsToBounds = false
    overrideUserInterfaceStyle = .light
    button.addAction(UIAction { [weak self] _ in self?.onPress() }, for: .touchUpInside)
    addSubview(button)
    for name in [UIContentSizeCategory.didChangeNotification,
      UIAccessibility.reduceTransparencyStatusDidChangeNotification,
      UIAccessibility.darkerSystemColorsStatusDidChangeNotification] {
      NotificationCenter.default.addObserver(self, selector: #selector(updateControl), name: name, object: nil)
    }
    updateControl()
  }

  @objc func updateControl() {
    let prominent = buttonRole == "accent"
    let navigation = buttonRole == "navigation" || buttonRole == "navigation-action"
    let neutral = buttonRole == "navigation"
    let opaque = UIAccessibility.isReduceTransparencyEnabled
    var config: UIButton.Configuration
    if #available(iOS 26.0, *), !opaque {
      // Keep Regular glass unmodified: UIKit owns its fill, optical rim,
      // adaptive shadow and press response, including the iOS 27 refinements.
      config = prominent ? .prominentGlass() : .glass()
      if prominent { config.baseBackgroundColor = tint }
    } else {
      config = .filled()
      config.baseBackgroundColor = prominent ? tint : .secondarySystemGroupedBackground
    }
    let foreground: UIColor = buttonDisabled && !loading ? .tertiaryLabel :
      (buttonRole == "destructive" ? .systemRed : (prominent ? .white : (neutral ? .label : tint)))
    config.baseForegroundColor = foreground
    config.imageColorTransformer = UIConfigurationColorTransformer { _ in foreground }
    config.activityIndicatorColorTransformer = UIConfigurationColorTransformer { _ in foreground }
    config.cornerStyle = .capsule
    config.title = buttonTitle.isEmpty ? nil : buttonTitle
    config.image = symbol.isEmpty ? nil : UIImage(systemName: symbol)
    config.imagePadding = buttonTitle.isEmpty ? 0 : 8
    if navigation {
      config.buttonSize = .medium
      // Header symbols must fit the 44 pt touch target even at accessibility
      // text sizes. Text keeps Dynamic Type; symbols grow only from 20 to 24 pt.
      let symbolSize = min(24, UIFontMetrics(forTextStyle: .body).scaledValue(for: 20, compatibleWith: traitCollection))
      config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: symbolSize, weight: .medium)
      config.image = config.image?.withTintColor(foreground, renderingMode: .alwaysOriginal)
    } else {
      config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(textStyle: .body, scale: .medium)
      // Glass renders a bare symbol with its own vibrant label colour; a destructive one must stay red.
      if buttonRole == "destructive" { config.image = config.image?.withTintColor(foreground, renderingMode: .alwaysOriginal) }
    }
    config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: buttonTitle.isEmpty ? 0 : 12,
      bottom: 8, trailing: buttonTitle.isEmpty ? 0 : 12)
    let font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .semibold), compatibleWith: traitCollection)
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = font
      return outgoing
    }
    config.showsActivityIndicator = loading
    if navigation && loading {
      // Fixed-size Save capsules cannot fit a spinner beside their title.
      // Replace the content in place; keep the native glass and outer bounds.
      config.title = nil
      config.image = nil
      config.imagePadding = 0
      config.contentInsets = .zero
    }
    // React re-sends props on every render, often while UIKit is animating (a
    // press, or a picker sheet presenting). Rebuild only on a real change, and
    // never inside someone else's animation: a configuration applied there
    // animates its fresh title label in from a stale frame for a moment.
    let key = [buttonTitle, symbol, buttonRole, buttonLabel, "\(buttonDisabled)", "\(loading)", "\(opaque)",
      "\(UIAccessibility.isDarkerSystemColorsEnabled)", traitCollection.preferredContentSizeCategory.rawValue].joined(separator: "|")
    guard key != configurationKey else { return }
    configurationKey = key
    UIView.performWithoutAnimation {
      button.tintColor = neutral ? .label : tint
      button.configuration = config
      button.isEnabled = !buttonDisabled && !loading
      button.layoutIfNeeded()
    }
    button.accessibilityLabel = buttonLabel.isEmpty ? buttonTitle : buttonLabel
    button.accessibilityValue = loading ? "Processing" : nil
    button.titleLabel?.adjustsFontForContentSizeCategory = true
    button.titleLabel?.numberOfLines = navigation ? 1 : 2
    button.titleLabel?.textAlignment = .center
    if #available(iOS 26.0, *) { button.cornerConfiguration = .capsule() }
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
    if metricsEnabled && bounds.width > 0 && bounds.height > 0 {
      let size = button.intrinsicContentSize
      let metrics: [String: Double] = ["width": Double(bounds.width), "height": Double(bounds.height),
        "buttonWidth": Double(button.bounds.width), "buttonHeight": Double(button.bounds.height),
        "intrinsicWidth": Double(size.width), "intrinsicHeight": Double(size.height),
        "loading": loading ? 1 : 0, "hasTitle": button.configuration?.title?.isEmpty == false ? 1 : 0]
      if metrics != lastMetrics { lastMetrics = metrics; onMetrics(metrics) }
    }
  }
  deinit { NotificationCenter.default.removeObserver(self) }
}
