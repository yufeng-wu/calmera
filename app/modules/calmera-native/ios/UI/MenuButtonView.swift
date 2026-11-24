import ExpoModulesCore

// Glass button that opens a UIMenu with a checkmark on the current choice,
// matching FormButton. With a title it acts as a fixed action (e.g. a
// prominent Save whose menu picks the meal); otherwise it shows the choice.
final class CalmeraMenuButtonView: ExpoView {
  let onSelect = EventDispatcher()
  var options: [String] = []
  var selected = ""
  var menuTitle = ""
  var buttonLabel = ""
  var buttonDisabled = false
  var buttonTitle = ""
  var symbol = ""
  var prominent = false
  var buttonHint = ""
  // An actions menu lists commands rather than choices: no checkmarks, and with a symbol
  // and no title the button is just that symbol (a "•••" menu).
  var actions = false
  var destructiveOptions: [String] = []
  private let button = UIButton(type: .system)
  // On iOS 26 a menu grows out of its button's glass and closes back into it, so a menu on the
  // prominent button turns solid orange as it closes. The prominent button's menu hangs on this
  // clear button laid over it instead, and the orange one underneath only shows the press.
  private let menuTrigger = UIButton(type: .custom)
  private var menuKey = ""
  private let tint = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    clipsToBounds = false
    overrideUserInterfaceStyle = .light
    button.showsMenuAsPrimaryAction = true
    // Keep the listed order even when the menu opens upward from the Save bar.
    if #available(iOS 16.0, *) { button.preferredMenuElementOrder = .fixed }
    addSubview(button)
    menuTrigger.showsMenuAsPrimaryAction = true
    if #available(iOS 16.0, *) { menuTrigger.preferredMenuElementOrder = .fixed }
    menuTrigger.addTarget(self, action: #selector(pressDown), for: [.touchDown, .touchDragEnter])
    menuTrigger.addTarget(self, action: #selector(pressUp), for: [.touchUpInside, .touchUpOutside, .touchCancel, .touchDragExit, .menuActionTriggered])
    addSubview(menuTrigger)
    for name in [UIContentSizeCategory.didChangeNotification,
      UIAccessibility.reduceTransparencyStatusDidChangeNotification,
      UIAccessibility.darkerSystemColorsStatusDidChangeNotification] {
      NotificationCenter.default.addObserver(self, selector: #selector(updateControl), name: name, object: nil)
    }
    updateControl()
  }

  @objc private func pressDown() { button.isHighlighted = true }
  @objc private func pressUp() { button.isHighlighted = false }

  @objc func updateControl() {
    var config: UIButton.Configuration
    if #available(iOS 26.0, *), !UIAccessibility.isReduceTransparencyEnabled {
      config = prominent ? .prominentGlass() : .glass()
      if prominent { config.baseBackgroundColor = tint }
    } else {
      config = .filled()
      config.baseBackgroundColor = prominent ? tint : .secondarySystemGroupedBackground
    }
    // A disabled prominent button keeps white on its fill; UIKit dims it.
    let foreground: UIColor = prominent ? .white : (buttonDisabled ? .tertiaryLabel : tint)
    config.baseForegroundColor = foreground
    config.imageColorTransformer = UIConfigurationColorTransformer { _ in foreground }
    config.cornerStyle = .capsule
    let iconOnly = actions && buttonTitle.isEmpty && !symbol.isEmpty
    let fixed = !buttonTitle.isEmpty || iconOnly
    config.title = iconOnly ? nil : (fixed ? buttonTitle : selected)
    config.image = UIImage(systemName: fixed ? symbol : "chevron.up.chevron.down")
    config.imagePlacement = fixed ? .leading : .trailing
    config.imagePadding = fixed ? 8 : 6
    config.preferredSymbolConfigurationForImage = fixed
      ? UIImage.SymbolConfiguration(textStyle: .body, scale: .medium)
      : UIImage.SymbolConfiguration(textStyle: .footnote, scale: .small)
    config.contentInsets = iconOnly ? NSDirectionalEdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8)
      : NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 14)
    // Resolve the font when UIKit applies it, so text-size changes are current.
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { [weak self] incoming in
      var outgoing = incoming
      outgoing.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .semibold), compatibleWith: self?.traitCollection)
      return outgoing
    }
    button.tintColor = prominent ? .white : tint
    button.configuration = config
    button.isEnabled = !buttonDisabled
    // Rebuild the menu only when its contents change.
    let key = ([menuTitle, selected, actions ? "actions" : "choices"] + options + destructiveOptions).joined(separator: "\u{1F}")
    // Which button opens the menu: the clear one over a prominent button, else the button itself.
    let overlaid = prominent
    let opener = overlaid ? menuTrigger : button
    menuTrigger.isHidden = !overlaid
    menuTrigger.isEnabled = !buttonDisabled
    button.isUserInteractionEnabled = !overlaid
    button.isAccessibilityElement = !overlaid
    if overlaid { button.menu = nil } else { menuTrigger.menu = nil }
    if key != menuKey || opener.menu == nil {
      menuKey = key
      opener.menu = UIMenu(title: menuTitle, options: actions ? [] : .singleSelection, children: options.map { option in
        UIAction(title: option, attributes: destructiveOptions.contains(option) ? .destructive : [],
          state: !actions && option == selected ? .on : .off) { [weak self] _ in
          self?.onSelect(["value": option])
        }
      })
    }
    opener.accessibilityLabel = buttonLabel.isEmpty ? (fixed ? buttonTitle : selected) : buttonLabel
    opener.accessibilityValue = actions ? nil : selected
    opener.accessibilityHint = buttonHint.isEmpty ? nil : buttonHint
    button.titleLabel?.adjustsFontForContentSizeCategory = true
    button.titleLabel?.numberOfLines = 1
    if #available(iOS 26.0, *) { button.cornerConfiguration = .capsule() }
    setNeedsLayout()
  }

  override func traitCollectionDidChange(_ previous: UITraitCollection?) {
    super.traitCollectionDidChange(previous)
    if previous?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory { updateControl() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
    menuTrigger.frame = bounds
  }
  deinit { NotificationCenter.default.removeObserver(self) }
}
