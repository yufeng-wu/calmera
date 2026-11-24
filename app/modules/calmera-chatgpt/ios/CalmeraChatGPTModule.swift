import ExpoModulesCore

public final class CalmeraChatGPTModule: Module {
  private let callback = PlanLoopback()
  private let picker = PlanPhotoPicker()

  public func definition() -> ModuleDefinition {
    Name("CalmeraChatGPT")
    View(CalmeraGlassView.self) {
      // Zero keeps the capsule shape; a panel passes its own corner radius.
      Prop("cornerRadius") { (view: CalmeraGlassView, value: Double) in view.cornerRadius = CGFloat(max(0, value)) }
    }
    View(CalmeraHeaderScrollEdgeView.self) {
      ViewName("HeaderScrollEdge")
      Events("onStatus")
      Prop("scrollViewTag") { (view: CalmeraHeaderScrollEdgeView, value: Int) in view.scrollViewTag = value }
      Prop("topExtension") { (view: CalmeraHeaderScrollEdgeView, value: Double) in view.topExtension = CGFloat(max(0, value)) }
      Prop("reportStatus") { (view: CalmeraHeaderScrollEdgeView, value: Bool) in view.reportStatus = value }
      OnViewDidUpdateProps { (view: CalmeraHeaderScrollEdgeView) in view.updateBinding() }
    }
    View(CalmeraFormButtonView.self) {
      ViewName("FormButton")
      Events("onPress", "onMetrics")
      Prop("metricsEnabled") { (view: CalmeraFormButtonView, value: Bool) in view.metricsEnabled = value }
      Prop("title") { (view: CalmeraFormButtonView, value: String) in view.buttonTitle = value }
      Prop("symbol") { (view: CalmeraFormButtonView, value: String) in view.symbol = value }
      Prop("buttonRole") { (view: CalmeraFormButtonView, value: String) in view.buttonRole = value }
      Prop("buttonLabel") { (view: CalmeraFormButtonView, value: String) in view.buttonLabel = value }
      Prop("buttonDisabled") { (view: CalmeraFormButtonView, value: Bool) in view.buttonDisabled = value }
      Prop("loading") { (view: CalmeraFormButtonView, value: Bool) in view.loading = value }
      OnViewDidUpdateProps { (view: CalmeraFormButtonView) in view.updateControl() }
    }
    View(CalmeraMenuButtonView.self) {
      ViewName("MenuButton")
      Events("onSelect")
      Prop("options") { (view: CalmeraMenuButtonView, value: [String]) in view.options = value }
      Prop("selected") { (view: CalmeraMenuButtonView, value: String) in view.selected = value }
      Prop("menuTitle") { (view: CalmeraMenuButtonView, value: String) in view.menuTitle = value }
      Prop("buttonLabel") { (view: CalmeraMenuButtonView, value: String) in view.buttonLabel = value }
      Prop("buttonDisabled") { (view: CalmeraMenuButtonView, value: Bool) in view.buttonDisabled = value }
      Prop("title") { (view: CalmeraMenuButtonView, value: String) in view.buttonTitle = value }
      Prop("symbol") { (view: CalmeraMenuButtonView, value: String) in view.symbol = value }
      Prop("prominent") { (view: CalmeraMenuButtonView, value: Bool) in view.prominent = value }
      Prop("buttonHint") { (view: CalmeraMenuButtonView, value: String) in view.buttonHint = value }
      Prop("actions") { (view: CalmeraMenuButtonView, value: Bool) in view.actions = value }
      Prop("destructiveOptions") { (view: CalmeraMenuButtonView, value: [String]) in view.destructiveOptions = value }
      OnViewDidUpdateProps { (view: CalmeraMenuButtonView) in view.updateControl() }
    }
    View(CalmeraSegmentedView.self) {
      ViewName("Segmented")
      Events("onSelect")
      Prop("options") { (view: CalmeraSegmentedView, value: [String]) in view.options = value }
      Prop("symbols") { (view: CalmeraSegmentedView, value: [String]) in view.symbols = value }
      Prop("selected") { (view: CalmeraSegmentedView, value: String) in view.selected = value }
      Prop("controlLabel") { (view: CalmeraSegmentedView, value: String) in view.controlLabel = value }
      Prop("controlDisabled") { (view: CalmeraSegmentedView, value: Bool) in view.controlDisabled = value }
      Prop("fitContent") { (view: CalmeraSegmentedView, value: Bool) in view.fitContent = value }
      OnViewDidUpdateProps { (view: CalmeraSegmentedView) in view.updateControl() }
    }
    View(CalmeraGoalSliderView.self) {
      ViewName("GoalSlider")
      Events("onValueChange", "onSlidingComplete")
      Prop("value") { (view: CalmeraGoalSliderView, value: Double) in view.value = value }
      Prop("valueUnset") { (view: CalmeraGoalSliderView, value: Bool) in view.valueUnset = value }
      Prop("minimumValue") { (view: CalmeraGoalSliderView, value: Double) in view.minimumValue = value }
      Prop("maximumValue") { (view: CalmeraGoalSliderView, value: Double) in view.maximumValue = value }
      Prop("step") { (view: CalmeraGoalSliderView, value: Double) in view.step = value }
      Prop("sliderDisabled") { (view: CalmeraGoalSliderView, value: Bool) in view.sliderDisabled = value }
      Prop("sliderLabel") { (view: CalmeraGoalSliderView, value: String) in view.sliderLabel = value }
      Prop("unit") { (view: CalmeraGoalSliderView, value: String) in view.unit = value }
      Prop("trackColor") { (view: CalmeraGoalSliderView, value: UIColor?) in view.trackColor = value }
      OnViewDidUpdateProps { (view: CalmeraGoalSliderView) in view.updateControl() }
    }
    View(CalmeraMealActionsView.self) {
      ViewName("MealActions")
      Prop("previewPalette") { (view: CalmeraMealActionsView, value: String) in view.previewPalette = value }
      Events("onAction", "onMetrics")
      Prop("buttonWidth") { (view: CalmeraMealActionsView, value: Double) in view.buttonWidth = CGFloat(max(44, value)) }
      Prop("buttonHeight") { (view: CalmeraMealActionsView, value: Double) in view.buttonHeight = CGFloat(max(44, value)) }
      Prop("effectOutset") { (view: CalmeraMealActionsView, value: Double) in view.effectOutset = CGFloat(max(0, value)) }
      Prop("actionsVisible") { (view: CalmeraMealActionsView, value: Bool) in view.actionsVisible = value }
      Prop("revealProgress") { (view: CalmeraMealActionsView, value: Double) in view.revealProgress = CGFloat(min(1, max(0, value))) }
      Prop("reportMetrics") { (view: CalmeraMealActionsView, value: Bool) in view.reportMetrics = value }
      OnViewDidUpdateProps { (view: CalmeraMealActionsView) in view.updateControls() }
    }

    View(CalmeraGoalsMenuView.self) {
      ViewName("GoalsMenu")
      Events("onEditGoals")
    }

    View(CalmeraSystemTabsView.self) {
      ViewName("SystemTabs")
      Prop("previewPalette") { (view: CalmeraSystemTabsView, value: String) in view.setPreviewPalette(value) }
      Events("onSelect")
      Prop("selectedIndex") { (view: CalmeraSystemTabsView, index: Int) in
        view.select(index)
      }
    }
    View(CalmeraActionMenuView.self) {
      ViewName("ActionMenu")
      Prop("previewPalette") { (view: CalmeraActionMenuView, value: String) in view.setPreviewPalette(value) }
      Events("onAction", "onMetrics")
      Prop("expanded") { (view: CalmeraActionMenuView, value: Bool) in view.expanded = value }
      Prop("recording") { (view: CalmeraActionMenuView, value: Bool) in view.recording = value }
      Prop("analyzing") { (view: CalmeraActionMenuView, value: Bool) in view.analyzing = value }
      Prop("seconds") { (view: CalmeraActionMenuView, value: Int) in view.seconds = value }
      Prop("bottomInset") { (view: CalmeraActionMenuView, value: Double) in view.bottomInset = CGFloat(max(0, value)) }
      Prop("optionWidth") { (view: CalmeraActionMenuView, value: Double) in view.optionWidth = CGFloat(min(300, max(120, value))) }
      Prop("motionDiagnostics") { (view: CalmeraActionMenuView, value: Bool) in view.motionDiagnostics = value }
      OnViewDidUpdateProps { (view: CalmeraActionMenuView) in view.render() }
    }
    AsyncFunction("startCallback") { (state: String, promise: Promise) in
      self.callback.start(state: state) { result in
        switch result {
        case .success(let uri): promise.resolve(uri)
        case .failure: promise.reject("callback_unavailable", "Could not start local authorization.")
        }
      }
    }
    AsyncFunction("waitForCallback") { (promise: Promise) in
      self.callback.wait { result in
        switch result {
        case .success(let uri): promise.resolve(uri)
        case .failure: promise.reject("authorization_cancelled", "Authorization cancelled or expired.")
        }
      }
    }
    Function("cancelCallback") { self.callback.stop() }
    AsyncFunction("validateIdentity") { (token: String, clientID: String, nonce: String, subject: String) async throws -> [String: String] in
      try await PlanIdentity.fetchAndVerify(token, clientID: clientID, nonce: nonce, priorSubject: subject)
    }
    AsyncFunction("pickPhoto") { (source: String, promise: Promise) in
      guard let controller = self.appContext?.utilities?.currentViewController() else {
        promise.reject("photo_unavailable", "Cannot open the photo picker.")
        return
      }
      self.picker.present(source: source, from: controller) { result in
        switch result {
        case .success(let photo): promise.resolve(photo)
        case .failure: promise.reject("image_unavailable", "Photo access was cancelled or unavailable.")
        }
      }
    }.runOnQueue(.main)
    OnDestroy { self.callback.stop() }
  }
}


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


// UIKit owns the tab buttons, selection lens and horizontal scrubbing gesture.
// Comparison tint is opt-in and restricted to the separate simulator test app.
// Production callers retain Tangerine until the user chooses a new palette.
private func comparisonAccent(_ id: String) -> UIColor {
  if id == "basil" && Bundle.main.bundleIdentifier == "com.yfwu02.calmera.chatgptdev" {
    return UIColor(red: 53/255, green: 92/255, blue: 69/255, alpha: 1)
  }
  return UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
}

// React Navigation continues to own the app screens and their lifecycle.
final class CalmeraSystemTabsView: ExpoView, UITabBarControllerDelegate {
  let onSelect = EventDispatcher()
  private let controller = UITabBarController()
  private var selected = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    backgroundColor = .clear
    controller.delegate = self
    isOpaque = false
    controller.view.backgroundColor = .clear
    controller.view.isOpaque = false
    controller.view.clipsToBounds = false
    controller.overrideUserInterfaceStyle = .light
    // Keep the real system glass and selection lens. A transparent host lets
    // React Native content behind this overlay participate in the backdrop.
    controller.edgesForExtendedLayout = .all
    controller.extendedLayoutIncludesOpaqueBars = true
    controller.tabBar.backgroundColor = .clear
    controller.tabBar.isOpaque = false
    controller.tabBar.isTranslucent = true
    controller.tabBar.clipsToBounds = false
    controller.tabBar.tintColor = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
    let definitions = [
      ("Today", "fork.knife", "fork.knife"),
      ("Insights", "chart.bar", "chart.bar.fill"),
      ("Settings", "gearshape", "gearshape.fill")
    ]
    controller.viewControllers = definitions.enumerated().map { index, definition in
      let page = UIViewController()
      page.edgesForExtendedLayout = .all
      page.extendedLayoutIncludesOpaqueBars = true
      page.view.backgroundColor = .clear
      page.view.isOpaque = false
      page.view.isUserInteractionEnabled = false
      page.tabBarItem = UITabBarItem(title: definition.0,
        image: UIImage(systemName: definition.1), selectedImage: UIImage(systemName: definition.2))
      page.tabBarItem.tag = index
      return page
    }
    addSubview(controller.view)
  }

  func setPreviewPalette(_ id: String) { controller.tabBar.tintColor = comparisonAccent(id) }

  func select(_ index: Int) {
    guard (0..<(controller.viewControllers?.count ?? 0)).contains(index) else { return }
    selected = index
    if controller.selectedIndex != index { controller.selectedIndex = index }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil && controller.parent == nil {
      var responder: UIResponder? = self.next
      while let current = responder {
        if let parent = current as? UIViewController {
          parent.addChild(controller)
          controller.didMove(toParent: parent)
          break
        }
        responder = current.next
      }
    }
  }

  override func didMoveToSuperview() {
    super.didMoveToSuperview()
    // A navigation transition can temporarily detach the window. Keep the child
    // controller attached until this React view is actually removed.
    if superview == nil && controller.parent != nil {
      controller.willMove(toParent: nil)
      controller.removeFromParent()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    controller.view.frame = bounds
    controller.view.setNeedsLayout()
    controller.view.layoutIfNeeded()
  }

  // The transparent host must not swallow scrolling beside the floating capsule.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard !isHidden, alpha > 0.01, isUserInteractionEnabled,
      self.point(inside: point, with: event) else { return nil }
    let local = controller.tabBar.convert(point, from: self)
    guard controller.tabBar.point(inside: local, with: event) else { return nil }
    let target = controller.tabBar.hitTest(local, with: event)
    return target === controller.tabBar ? nil : target
  }

  func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
    selected = tabBarController.selectedIndex
    onSelect(["index": selected])
  }
}


// One native container lets glass surfaces merge and split in the same transaction.
// This view receives UI state only; recording, inference and storage stay in React.
final class CalmeraActionMenuView: ExpoView, UIGestureRecognizerDelegate {
  let onAction = EventDispatcher()
  let onMetrics = EventDispatcher()
  var expanded = false
  var recording = false
  var analyzing = false
  var seconds = 0
  var bottomInset: CGFloat = 0
  var optionWidth: CGFloat = 120
  var motionDiagnostics = false
  private let container = UIVisualEffectView()
  private var glasses: [UIVisualEffectView] = []
  private var buttons: [UIButton] = []
  private var rows: [UIStackView] = []
  private var labels: [UILabel] = []
  private var icons: [UIImageView] = []
  private var rowWidths: [NSLayoutConstraint] = []
  private var triggerTitleWidth: NSLayoutConstraint?
  private let processingIndicator = UIActivityIndicatorView(style: .medium)
  private var typographyRefreshPending = false
  private var animationGeneration = 0
  private var settledGeneration = 0
  private var triggerMaterialAssignments = 0
  private var priorExpanded: Bool?
  private var priorRecording = false
  private var priorAnalyzing = false
  private var priorBottomInset: CGFloat?
  private var priorOptionWidth: CGFloat?
  private var lastBounds = CGRect.zero
  private var visible = [false, false, false, true]
  private var voiceAnimator: UIViewPropertyAnimator?
  private var voiceReturnLink: CADisplayLink?
  private var voiceReturnGeneration = 0
  private var voiceReturnSamples = 0
  private var voiceReturnMaxAnchorError: CGFloat = 0
  private var voiceReturnBadSamples = 0
  private var voiceReturnStartWidth: CGFloat = 0
  private static let optionTitles = ["Photo", "Text", "Voice"]
  private var previewPalette = "tangerine"
  private var tint: UIColor { comparisonAccent(previewPalette) }
  func setPreviewPalette(_ id: String) {
    guard id != previewPalette else { return }
    previewPalette = id
    labels.forEach { $0.textColor = tint }
    icons.forEach { $0.tintColor = tint }
    processingIndicator.color = tint
  }
  private var itemHeight: CGFloat { max(48, ceil((labels.first?.font.lineHeight ?? 17) + 24)) }
  private var triggerHeight: CGFloat { max(56, ceil((labels.last?.font.lineHeight ?? 17) + 24)) }
  private var triggerWidth: CGFloat {
    if expanded { return triggerHeight }
    return max(84, ceil(labels[3].intrinsicContentSize.width) + 56)
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    clipsToBounds = false
    overrideUserInterfaceStyle = .light
    configureContainer()
    container.backgroundColor = .clear
    container.clipsToBounds = false
    container.contentView.clipsToBounds = false
    addSubview(container)
    let titles = ["Photo", "Text", "Voice", "Add"]
    let symbols = ["camera", "pencil", "mic", "plus"]
    for index in 0..<4 {
      let glass = UIVisualEffectView()
      // Let UIKit draw the optical rim and shadow outside the capsule. Layer
      // clipping cuts off the native glass edge and makes it look like a fill.
      if #available(iOS 26.0, *) {
        glass.cornerConfiguration = .capsule()
        glass.clipsToBounds = false
      } else {
        glass.layer.cornerRadius = 28
        glass.clipsToBounds = true
      }
      let button = UIButton(type: .custom)
      button.tag = index
      button.accessibilityLabel = ["Log a meal from a photo", "Add a meal with text", "Log a meal by voice", "Add a meal"][index]
      button.translatesAutoresizingMaskIntoConstraints = false
      glass.contentView.addSubview(button)
      NSLayoutConstraint.activate([
        button.leadingAnchor.constraint(equalTo: glass.contentView.leadingAnchor),
        button.trailingAnchor.constraint(equalTo: glass.contentView.trailingAnchor),
        button.topAnchor.constraint(equalTo: glass.contentView.topAnchor),
        button.bottomAnchor.constraint(equalTo: glass.contentView.bottomAnchor)
      ])
      let icon = UIImageView(image: UIImage(systemName: symbols[index]))
      icon.tintColor = tint
      // Drawn at one symbol size and centred in the 20-point column, rather than each stretched to fit it, so the
      // wide camera, the square pencil and the narrow mic keep the same weight and share one centre line.
      // The Add button's plus keeps its own fitted size.
      if index < 3 {
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 16, weight: .medium)
        icon.contentMode = .center
      } else {
        icon.contentMode = .scaleAspectFit
      }
      if index == 2 {
        processingIndicator.color = tint
        processingIndicator.hidesWhenStopped = true
        processingIndicator.translatesAutoresizingMaskIntoConstraints = false
        icon.addSubview(processingIndicator)
        NSLayoutConstraint.activate([
          processingIndicator.centerXAnchor.constraint(equalTo: icon.centerXAnchor),
          processingIndicator.centerYAnchor.constraint(equalTo: icon.centerYAnchor)
        ])
      }
      NSLayoutConstraint.activate([icon.widthAnchor.constraint(equalToConstant: 20), icon.heightAnchor.constraint(equalToConstant: 20)])
      let label = UILabel()
      label.text = titles[index]
      label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .semibold), compatibleWith: traitCollection)
      label.adjustsFontForContentSizeCategory = true
      label.textColor = tint
      label.numberOfLines = 1
      label.adjustsFontSizeToFitWidth = true
      label.minimumScaleFactor = 0.75
      label.clipsToBounds = true
      if index == 3 {
        let width = label.widthAnchor.constraint(equalToConstant: ceil(label.intrinsicContentSize.width))
        width.isActive = true
        triggerTitleWidth = width
      }
      let row = UIStackView(arrangedSubviews: [icon, label])
      row.axis = .horizontal
      row.alignment = .center
      row.spacing = index == 3 ? 4 : 10
      row.isUserInteractionEnabled = false
      row.translatesAutoresizingMaskIntoConstraints = false
      button.addSubview(row)
      let contentWidth = row.widthAnchor.constraint(equalToConstant: 20 + row.spacing + ceil((titles[index] as NSString).size(withAttributes: [.font: label.font!]).width))
      contentWidth.priority = UILayoutPriority(999)
      contentWidth.isActive = true
      rowWidths.append(contentWidth)
      NSLayoutConstraint.activate([
        row.centerXAnchor.constraint(equalTo: button.centerXAnchor),
        row.centerYAnchor.constraint(equalTo: button.centerYAnchor),
        row.widthAnchor.constraint(lessThanOrEqualTo: button.widthAnchor, constant: -32)
      ])
      button.addTarget(self, action: #selector(tapped(_:)), for: .touchUpInside)
      if index == 2 { button.accessibilityHint = "Opens a voice panel to describe your meal." }
      container.contentView.addSubview(glass)
      glasses.append(glass); buttons.append(button); rows.append(row); labels.append(label); icons.append(icon)
    }
    let dismiss = UITapGestureRecognizer(target: self, action: #selector(backgroundTapped))
    dismiss.delegate = self
    addGestureRecognizer(dismiss)
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(contentSizeChanged), name: UIContentSizeCategory.didChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.darkerSystemColorsStatusDidChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(motionChanged), name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)
  }

  private func configureContainer() {
    if #available(iOS 26.0, *), !UIAccessibility.isReduceTransparencyEnabled {
      let effect = UIGlassContainerEffect()
      effect.spacing = 8
      container.effect = effect
    } else { container.effect = nil }
  }

  @objc private func accessibilityChanged() {
    configureContainer()
    priorExpanded = nil
    refreshTypography()
  }

  @objc private func motionChanged() {
    guard glasses.count == 4 else { return }
    // Settle our own geometry/content animations immediately. Keep the mounted
    // Regular glass effects so changing accessibility never rematerializes them.
    animationGeneration += 1
    stopVoiceGrowth()
    for view in glasses + rows + labels + icons {
      view.layer.removeAllAnimations()
    }
    if voiceReturnLink != nil { finishVoiceReturnCheck(voiceReturnGeneration) }
    render(animated: false, force: true)
  }

  @objc private func contentSizeChanged() { scheduleTypographyRefresh() }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if previousTraitCollection?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory {
      scheduleTypographyRefresh()
    }
  }

  private func scheduleTypographyRefresh() {
    guard !typographyRefreshPending else { return }
    typographyRefreshPending = true
    // A content-size notification can precede UILabel's trait/font update.
    // Coalesce notification + trait changes and measure the resolved category.
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.typographyRefreshPending = false
      guard self.window != nil else { return }
      self.refreshTypography()
    }
  }

  private func refreshTypography() {
    for label in labels {
      label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(
        for: .systemFont(ofSize: 14, weight: .semibold), compatibleWith: traitCollection)
    }
    // Size changes update geometry only; keep the mounted glass identities.
    render(animated: false, force: true)
  }

  private func material() -> UIVisualEffect? {
    if UIAccessibility.isReduceTransparencyEnabled { return nil }
    if #available(iOS 26.0, *) {
      // Add/Close floats over plain white as often as over meal content. Keep
      // the same regular glass as its options; clear glass loses its boundary
      // on white. UIKit owns the adaptive optical edge and shadow.
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = true
      return glass
    }
    return UIBlurEffect(style: .systemMaterial)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    container.frame = bounds
    if bounds != lastBounds {
      lastBounds = bounds
      render(animated: false, force: true)
    }
  }

  private func frame(for index: Int, width: CGFloat) -> CGRect {
    let height = index == 3 ? triggerHeight : itemHeight
    let triggerY = bounds.height - bottomInset - 40 - triggerHeight
    let y = index == 3 ? triggerY : triggerY - CGFloat(3 - index) * (itemHeight + 12)
    return CGRect(x: bounds.width - 20 - width, y: y, width: width, height: height)
  }

  func render(animated: Bool = true, force: Bool = false) {
    guard bounds.width > 40, glasses.count == 4 else { return }
    let first = priorExpanded == nil
    let previousVisibility = visible
    let geometryChanged = force || priorBottomInset != bottomInset || priorOptionWidth != optionWidth
    let changed = geometryChanged || priorExpanded != expanded || priorRecording != recording || priorAnalyzing != analyzing
    labels[2].text = analyzing ? "Processing…" : recording ? "\(seconds)s · Release" : "Voice"
    icons[2].image = analyzing ? nil : UIImage(systemName: recording ? "waveform" : "mic")
    if analyzing { processingIndicator.startAnimating() } else { processingIndicator.stopAnimating() }
    buttons[2].accessibilityValue = analyzing ? "Processing your meal" : recording ? "Recording" : nil
    // Never animate UIStackView.isHidden: interrupted hide animations can leave a plus-only button.
    labels[3].isHidden = false
    buttons[0].isEnabled = !recording
    buttons[1].isEnabled = !recording
    buttons[2].isEnabled = !analyzing
    buttons[3].isEnabled = !recording
    buttons[3].accessibilityLabel = expanded ? "Close add meal menu" : "Add a meal"
    accessibilityViewIsModal = expanded
    // Photo, Text and Voice share one content width, so their icons sit in one column and their titles start on one
    // line; each title is left-aligned in that width. A longer Voice title while recording widens only Voice.
    let optionTitleWidth = ceil(Self.optionTitles.map { ($0 as NSString).size(withAttributes: [.font: labels[0].font!]).width }.max() ?? 0)
    for index in 0..<4 {
      let ownWidth = ceil(((labels[index].text ?? "") as NSString).size(withAttributes: [.font: labels[index].font!]).width)
      let textWidth = index < 3 ? max(ownWidth, optionTitleWidth) : ownWidth
      rowWidths[index].constant = index == 3 && expanded ? 20 : 20 + (index == 3 ? 4 : rows[index].spacing) + textWidth
    }
    visible = [expanded, expanded, expanded || recording || analyzing, true]
    for index in 0..<4 {
      glasses[index].accessibilityElementsHidden = !visible[index]
      buttons[index].isUserInteractionEnabled = visible[index] && !(recording && index < 2)
    }
    if !changed { glasses[2].layoutIfNeeded(); return }
    animationGeneration += 1
    let generation = animationGeneration
    let frozenVoiceWidth = stopVoiceGrowth()
    let startsRecording = recording && !priorRecording
    let resumesRecording = recording && priorRecording
    let releasesRecording = priorRecording && !recording
    let returnGeneration: Int? = releasesRecording ? beginVoiceReturnCheck() : nil
    priorExpanded = expanded; priorRecording = recording; priorAnalyzing = analyzing
    priorBottomInset = bottomInset; priorOptionWidth = optionWidth
    let trigger = frame(for: 3, width: triggerWidth)
    if first {
      for glass in glasses { glass.frame = trigger }
    }
    let longestTitle = Self.optionTitles.map {
      ($0 as NSString).size(withAttributes: [.font: labels[0].font!]).width
    }.max() ?? 0
    let width = min(max(optionWidth, ceil(longestTitle) + 62), bounds.width - 40)
    let resumedVoiceWidth = min(bounds.width - 40, max(width, frozenVoiceWidth, rowWidths[2].constant + 32))
    let update = {
      for index in 0..<4 {
        let show = self.visible[index]
        let processingWidth = min(self.bounds.width - 40, max(width, self.rowWidths[2].constant + 32))
        let targetWidth = index == 3 ? self.triggerWidth : index == 2 && self.analyzing ? processingWidth
          : index == 2 && resumesRecording ? resumedVoiceWidth : width
        self.glasses[index].frame = index == 3 || show ? self.frame(for: index, width: targetWidth) : trigger
        if #unavailable(iOS 26.0) {
          self.glasses[index].layer.cornerRadius = (index == 3 ? self.triggerHeight : self.itemHeight) / 2
        }
        // A recording/processing label change is not a new glass element.
        // Keep its material identity; replacing it during a frame animation can
        // trigger an unrelated container materialization from a default origin.
        if first || previousVisibility[index] != show {
          self.glasses[index].effect = show ? self.material() : nil
          if index == 3 && self.motionDiagnostics { self.triggerMaterialAssignments += 1 }
        }
        self.glasses[index].backgroundColor = show && UIAccessibility.isReduceTransparencyEnabled ? .secondarySystemBackground : .clear
        self.rows[index].alpha = show ? 1 : 0
        self.glasses[index].layoutIfNeeded()
      }
      self.triggerTitleWidth?.constant = self.expanded ? 0 : ceil(self.labels[3].intrinsicContentSize.width)
      self.rows[3].spacing = self.expanded ? 0 : 4
      self.labels[3].alpha = self.expanded ? 0 : 1
      self.icons[3].transform = self.expanded ? CGAffineTransform(rotationAngle: .pi / 4) : .identity
      self.glasses[3].layoutIfNeeded()
    }
    if animated && !first && !UIAccessibility.isReduceMotionEnabled {
      // Release starts from the anchored model frame frozen below. Re-reading
      // a glass presentation frame via beginFromCurrentState can reintroduce
      // UIKit's temporary interaction coordinates and launch it from (0,0).
      let options: UIView.AnimationOptions = releasesRecording
        ? [.allowUserInteraction] : [.beginFromCurrentState, .allowUserInteraction]
      UIView.animate(withDuration: releasesRecording ? 0.38 : expanded ? 0.4 : 0.26, delay: 0,
        usingSpringWithDamping: releasesRecording ? 0.80 : expanded ? 0.82 : 0.95, initialSpringVelocity: 0,
        options: options, animations: update,
        completion: { [weak self] _ in
          guard let self else { return }
          // Voice sampling has its own generation guard and must stop even
          // if a newer menu transition (e.g. Close during Processing) won.
          if let returnGeneration { self.finishVoiceReturnCheck(returnGeneration) }
          guard generation == self.animationGeneration else { return }
          self.settledGeneration = generation
          self.settleTriggerTitle()
          self.reportMetrics()
        })
    } else {
      update(); settledGeneration = generation; settleTriggerTitle()
      if let returnGeneration { finishVoiceReturnCheck(returnGeneration) }
    }
    if startsRecording || resumesRecording { growVoice(resuming: resumesRecording) }
    reportMetrics()
  }

  private func settleTriggerTitle() {
    guard !expanded else { return }
    labels[3].isHidden = false
    labels[3].alpha = 1
    triggerTitleWidth?.constant = ceil(labels[3].intrinsicContentSize.width)
    rowWidths[3].constant = 24 + ceil(labels[3].intrinsicContentSize.width)
    rows[3].spacing = 4
    glasses[3].layoutIfNeeded()
    reportMetrics()
  }

  private func reportMetrics() {
    var metrics: [String: Double] = [:]
    for (index, key) in ["photo", "text", "voice"].enumerated() {
      glasses[index].layoutIfNeeded()
      buttons[index].layoutIfNeeded()
      metrics[key] = Double(glasses[index].bounds.width)
      let rowInGlass = rows[index].convert(rows[index].bounds, to: glasses[index])
      metrics[key + "Left"] = Double(rowInGlass.minX)
      metrics[key + "Right"] = Double(glasses[index].bounds.width - rowInGlass.maxX)
    }
    metrics["addTitleVisible"] = !labels[3].isHidden && labels[3].alpha > 0.99 && (triggerTitleWidth?.constant ?? 0) > 0 ? 1 : 0
    metrics["processing"] = analyzing ? 1 : 0
    metrics["voiceHeight"] = Double(glasses[2].bounds.height)
    if motionDiagnostics {
      // Public UIView/material state only. No private glass layers or pixels;
      // these checks complement (not replace) a white-background visual review.
      let opaque = UIAccessibility.isReduceTransparencyEnabled
      let shown = glasses.indices.filter { visible[$0] }
      metrics["menuExpanded"] = expanded ? 1 : 0
      metrics["animationGeneration"] = Double(animationGeneration)
      metrics["settledGeneration"] = Double(settledGeneration)
      metrics["triggerMaterialAssignments"] = Double(triggerMaterialAssignments)
      metrics["visibleSurfaces"] = Double(shown.count)
      metrics["missingMaterials"] = Double(shown.filter { !opaque && glasses[$0].effect == nil }.count)
      metrics["clippedSurfaces"] = Double(shown.filter { glasses[$0].clipsToBounds }.count)
      metrics["effectHostClipped"] = clipsToBounds || container.clipsToBounds || container.contentView.clipsToBounds ? 1 : 0
      metrics["triggerWidth"] = Double(glasses[3].bounds.width)
      metrics["triggerHeight"] = Double(glasses[3].bounds.height)
      metrics["triggerTop"] = Double(glasses[3].frame.minY)
      metrics["menuBottomInset"] = Double(bottomInset)
      metrics["menuOptionWidth"] = Double(optionWidth)
      metrics["voiceGrowing"] = voiceAnimator?.isRunning == true ? 1 : 0
      metrics["reduceMotion"] = UIAccessibility.isReduceMotionEnabled ? 1 : 0
      metrics["opaqueFallback"] = opaque ? 1 : 0
      if #available(iOS 26.0, *) {
        metrics["triggerNativeGlass"] = glasses[3].effect is UIGlassEffect ? 1 : 0
        metrics["nonGlassMaterials"] = Double(shown.filter {
          !opaque && !(glasses[$0].effect is UIGlassEffect)
        }.count)
      }
      metrics["voiceReturnSamples"] = Double(voiceReturnSamples)
      metrics["voiceReturnBadSamples"] = Double(voiceReturnBadSamples)
      metrics["voiceReturnMaxAnchorError"] = Double(voiceReturnMaxAnchorError)
      metrics["voiceReturnStartWidth"] = Double(voiceReturnStartWidth)
      metrics["voiceAnchorRight"] = Double(glasses[2].frame.maxX)
      metrics["voiceAnchorTop"] = Double(glasses[2].frame.minY)
    }
    onMetrics(metrics)
  }

  @discardableResult private func stopVoiceGrowth() -> CGFloat {
    guard let animator = voiceAnimator else { return glasses[2].bounds.width }
    // Glass can have temporary interaction transforms. Its presentation frame
    // is not a reliable placement to copy into the container's coordinate space.
    // Preserve only the visible width and rebuild the canonical right/top anchor.
    let sampledWidth = glasses[2].layer.presentation()?.bounds.width ?? glasses[2].bounds.width
    let currentWidth = sampledWidth.isFinite && sampledWidth > 0 ? sampledWidth : glasses[2].bounds.width
    let width = min(max(optionWidth, currentWidth), max(optionWidth, bounds.width - 40))
    animator.stopAnimation(true)
    voiceAnimator = nil
    UIView.performWithoutAnimation {
      self.glasses[2].layer.removeAllAnimations()
      self.glasses[2].transform = .identity
      self.glasses[2].frame = self.frame(for: 2, width: width)
      self.glasses[2].layoutIfNeeded()
    }
    return width
  }

  private func beginVoiceReturnCheck() -> Int {
    voiceReturnGeneration += 1
    voiceReturnLink?.invalidate()
    voiceReturnLink = nil
    voiceReturnSamples = 0
    voiceReturnMaxAnchorError = 0
    voiceReturnBadSamples = 0
    voiceReturnStartWidth = glasses[2].bounds.width
    guard motionDiagnostics else { return voiceReturnGeneration }
    // The release transaction has not committed yet; its presentation tree
    // still belongs to the interrupted growth. Check the frozen model start,
    // then sample only actually presented return frames on display ticks.
    recordVoiceReturnFrame(glasses[2].frame)
    let link = CADisplayLink(target: self, selector: #selector(sampleVoiceReturn))
    link.preferredFramesPerSecond = 60
    link.add(to: .main, forMode: .common)
    voiceReturnLink = link
    return voiceReturnGeneration
  }

  @objc private func sampleVoiceReturn() {
    guard motionDiagnostics, glasses.count == 4 else { return }
    // Glass compositing can place the layer below an internal render layer.
    // A raw presentation.frame is in that layer's space, not UIView.superview
    // space. Convert both presentation layers before comparing menu anchors.
    if let presentation = glasses[2].layer.presentation(),
      let containerPresentation = container.contentView.layer.presentation() {
      let current = presentation.convert(presentation.bounds, to: containerPresentation)
      recordVoiceReturnFrame(current)
    } else {
      recordVoiceReturnFrame(glasses[2].frame)
    }
  }

  private func recordVoiceReturnFrame(_ current: CGRect) {
    let expected = frame(for: 2, width: current.width)
    let error = max(abs(current.maxX - expected.maxX), abs(current.minY - expected.minY))
    voiceReturnMaxAnchorError = max(voiceReturnMaxAnchorError, error)
    if error > 1 { voiceReturnBadSamples += 1 }
    voiceReturnSamples += 1
  }

  private func finishVoiceReturnCheck(_ generation: Int) {
    guard generation == voiceReturnGeneration else { return }
    sampleVoiceReturn()
    voiceReturnLink?.invalidate()
    voiceReturnLink = nil
    reportMetrics()
  }

  private func growVoice(resuming: Bool = false) {
    let firstWidth = min(max(glasses[2].bounds.width, optionWidth + 40, rowWidths[2].constant + 32), bounds.width - 40)
    if UIAccessibility.isReduceMotionEnabled {
      glasses[2].frame = frame(for: 2, width: firstWidth)
      glasses[2].layoutIfNeeded()
      return
    }
    if resuming {
      // A layout/accessibility refresh preserves the sampled width and its
      // canonical right/top anchor, then continues only the remaining growth.
      continueVoiceGrowth(duration: max(0, 30 - Double(seconds)))
      return
    }
    let phase = UIViewPropertyAnimator(duration: 0.22, dampingRatio: 0.85) {
      self.glasses[2].frame = self.frame(for: 2, width: firstWidth)
      self.glasses[2].layoutIfNeeded()
    }
    phase.addCompletion { [weak self] position in
      guard let self, position == .end, self.recording else { return }
      self.continueVoiceGrowth(duration: 30)
    }
    voiceAnimator = phase
    phase.startAnimation()
  }

  private func continueVoiceGrowth(duration: TimeInterval) {
    guard recording, !UIAccessibility.isReduceMotionEnabled, duration > 0 else { return }
    let targetWidth = min(bounds.width - 40,
      max(glasses[2].bounds.width, rowWidths[2].constant + 32, bounds.width * 0.7))
    let grow = UIViewPropertyAnimator(duration: duration, curve: .easeOut) {
      self.glasses[2].frame = self.frame(for: 2, width: targetWidth)
      self.glasses[2].layoutIfNeeded()
    }
    voiceAnimator = grow
    grow.startAnimation()
  }

  @objc private func tapped(_ button: UIButton) {
    let actions = ["photo", "text", "voiceTap", "toggle"]
    if button.tag == 3 {
      guard !recording else { return }
      UIImpactFeedbackGenerator(style: .soft).impactOccurred()
      expanded.toggle()
      render()
    }
    onAction(["action": actions[button.tag]])
  }

  @objc private func backgroundTapped() {
    guard expanded, !recording else { return }
    expanded = false
    render()
    onAction(["action": "close"])
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    touch.view === self
  }

  override func accessibilityPerformEscape() -> Bool {
    guard expanded, !recording else { return false }
    backgroundTapped()
    return true
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard !isHidden, alpha > 0.01, isUserInteractionEnabled,
      self.point(inside: point, with: event) else { return nil }
    for index in (0..<4).reversed() where visible[index] {
      let local = glasses[index].convert(point, from: self)
      if glasses[index].point(inside: local, with: event),
        let target = glasses[index].hitTest(local, with: event) { return target }
    }
    return expanded ? self : nil
  }

  deinit {
    voiceReturnLink?.invalidate()
    voiceAnimator?.stopAnimation(true)
    NotificationCenter.default.removeObserver(self)
  }
}


// A transparent interaction surface above the existing React summary card.
// UIKit owns the card lift, native menu material and dismissal animation.
final class CalmeraGoalsMenuView: ExpoView, UIContextMenuInteractionDelegate {
  let onEditGoals = EventDispatcher()
  private var menuVisible = false
  private var editPending = false
  private weak var menuHost: UIView?
  private lazy var menuInteraction = UIContextMenuInteraction(delegate: self)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    isAccessibilityElement = false
    accessibilityElementsHidden = true
    isUserInteractionEnabled = false
  }

  override func didMoveToSuperview() {
    super.didMoveToSuperview()
    guard menuHost !== superview else { return }
    menuHost?.removeInteraction(menuInteraction)
    menuHost = superview
    menuHost?.addInteraction(menuInteraction)
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
    configurationForMenuAtLocation location: CGPoint) -> UIContextMenuConfiguration? {
    editPending = false
    return UIContextMenuConfiguration(identifier: nil, previewProvider: { [weak self] in
      guard let card = self?.menuHost,
        let content = card.snapshotView(afterScreenUpdates: false) else { return nil }
      // UIKit-only transient preview; never serialize or write an image.
      let controller = UIViewController()
      controller.view = UIView(frame: card.bounds)
      controller.view.backgroundColor = .white
      controller.view.layer.cornerRadius = 20
      controller.view.clipsToBounds = true
      content.frame = controller.view.bounds
      content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      controller.view.addSubview(content)
      controller.preferredContentSize = card.bounds.size
      return controller
    }) { [weak self] _ in
      let edit = UIAction(title: "Edit goals", image: UIImage(systemName: "slider.horizontal.3")) { [weak self] _ in
        guard let self else { return }
        self.editPending = true
        if !self.menuVisible { self.finishEditingAction() }
      }
      return UIMenu(children: [edit])
    }
  }

  private func cardPreview() -> UITargetedPreview? {
    guard let card = menuHost, card.window != nil else { return nil }
    let parameters = UIPreviewParameters()
    // Match the rich preview and React card. A clear dismissal background
    // exposes the cream page until UIKit hands the card back to React.
    parameters.backgroundColor = .white
    parameters.visiblePath = UIBezierPath(roundedRect: card.bounds, cornerRadius: 20)
    return UITargetedPreview(view: card, parameters: parameters)
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
    configuration: UIContextMenuConfiguration, highlightPreviewForItemWithIdentifier identifier: NSCopying) -> UITargetedPreview? {
    cardPreview()
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
    configuration: UIContextMenuConfiguration, dismissalPreviewForItemWithIdentifier identifier: NSCopying) -> UITargetedPreview? {
    cardPreview()
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
    willDisplayMenuFor configuration: UIContextMenuConfiguration, animator: UIContextMenuInteractionAnimating?) {
    menuVisible = true
  }

  func contextMenuInteraction(_ interaction: UIContextMenuInteraction,
    willEndFor configuration: UIContextMenuConfiguration, animator: UIContextMenuInteractionAnimating?) {
    let finish: () -> Void = { [weak self] in
      self?.menuVisible = false
      self?.finishEditingAction()
    }
    if let animator { animator.addCompletion(finish) }
    else { finish() }
  }

  private func finishEditingAction() {
    guard editPending else { return }
    editPending = false
    onEditGoals()
  }
}


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


// A decorative child of the actual React header. UIKit derives the scroll
// edge from that header's real labels/controls; React still owns all layout,
// scrolling, content insets and gestures. Resolve only the explicit scroll ref.
final class CalmeraHeaderScrollEdgeView: ExpoView {
  let onStatus = EventDispatcher()
  var scrollViewTag = 0
  var topExtension: CGFloat = 0 {
    didSet { if oldValue != topExtension { setNeedsLayout() } }
  }
  var reportStatus = false
  private weak var headerHost: UIView?
  private weak var boundScrollView: UIScrollView?
  private var edgeInteraction: UIInteraction?
  private var previousStyle: AnyObject?
  private var previousHidden = false
  private var bindingGeneration = 0
  private var lastStatus: [String: Double] = [:]
  private let backdrop = UIVisualEffectView()
  private let backdropMask = UIView()
  private let backdropFade = CAGradientLayer()
  private var backdropOpaque: Bool?
  private var backdropRequired: Bool?
  private var scrollObservation: NSKeyValueObservation?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
    isUserInteractionEnabled = false
    isAccessibilityElement = false
    accessibilityElementsHidden = true
    clipsToBounds = false
    overrideUserInterfaceStyle = .light
    backdrop.isUserInteractionEnabled = false
    backdropMask.isUserInteractionEnabled = false
    backdropFade.colors = [UIColor.black.cgColor, UIColor.black.cgColor, UIColor.clear.cgColor]
    backdropFade.startPoint = CGPoint(x: 0.5, y: 0)
    backdropFade.endPoint = CGPoint(x: 0.5, y: 1)
    backdropMask.layer.addSublayer(backdropFade)
    addSubview(backdrop)
    updateBackdrop()
    NotificationCenter.default.addObserver(self, selector: #selector(updateBackdrop),
      name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil)
  }

  @objc private func updateBackdrop() {
    refreshBackdrop(animated: false)
    emitBoundStatus()
  }

  private func refreshBackdrop(animated: Bool) {
    let opaque = UIAccessibility.isReduceTransparencyEnabled
    let offset = (boundScrollView?.contentOffset.y ?? 0)
      + (boundScrollView?.adjustedContentInset.top ?? 0)
    let required = opaque || offset > 0.5
    guard backdropOpaque != opaque || backdropRequired != required else { return }
    backdropOpaque = opaque
    backdropRequired = required
    // At rest, Regular glass sits directly over the page canvas. Add only a
    // lighter, fading scroll backdrop once content moves under the header.
    // Animate the effect itself, never the alpha of a glass view or ancestor.
    let changes = {
      self.backdrop.effect = !opaque && required ? UIBlurEffect(style: .systemThinMaterial) : nil
      self.backdrop.backgroundColor = opaque ? .systemBackground : .clear
    }
    if animated && window != nil && !UIAccessibility.isReduceMotionEnabled {
      UIView.animate(withDuration: 0.18, delay: 0,
        options: [.beginFromCurrentState, .allowUserInteraction], animations: changes)
    } else { UIView.performWithoutAnimation(changes) }
  }

  override func didMoveToSuperview() {
    super.didMoveToSuperview()
    detach()
    updateBinding()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      bindingGeneration += 1
      detach()
    } else { updateBinding() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let size = CGSize(width: bounds.width, height: bounds.height + topExtension + 24)
    backdrop.frame = CGRect(origin: CGPoint(x: 0, y: -topExtension), size: size)
    if backdropMask.bounds.size != size {
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      backdropMask.frame = CGRect(origin: .zero, size: size)
      backdropFade.frame = backdropMask.bounds
      let fadeStart = size.height > 0 ? max(0, size.height - 36) / size.height : 0
      backdropFade.locations = [0, NSNumber(value: Double(fadeStart)), 1]
      CATransaction.commit()
      // UIKit copies a directly assigned effect-view mask; reassign on resize.
      backdrop.mask = backdropMask
    }
    updateBinding()
  }

  func updateBinding() {
    bindingGeneration += 1
    let generation = bindingGeneration
    // The React tag can arrive before its native view is mounted. A bounded
    // retry handles that ordering without polling frames or scanning a window.
    DispatchQueue.main.async { [weak self] in
      self?.bind(generation: generation, attempt: 0)
    }
  }

  private func bind(generation: Int, attempt: Int) {
    guard generation == bindingGeneration else { return }
    guard #available(iOS 26.0, *) else {
      detach()
      emitStatus(available: false, bound: false, code: 1)
      return
    }
    guard scrollViewTag > 0, let host = superview, window != nil else {
      detach()
      emitStatus(available: true, bound: false, code: 2)
      return
    }
    guard let scrollHost = appContext?.findView(withTag: scrollViewTag, ofType: UIView.self),
      let scroll = findScrollView(in: scrollHost), scroll.window === window else {
      detach()
      emitStatus(available: true, bound: false, code: 3)
      if attempt < 3 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05 * Double(attempt + 1)) { [weak self] in
          self?.bind(generation: generation, attempt: attempt + 1)
        }
      }
      return
    }
    if headerHost !== host || boundScrollView !== scroll || edgeInteraction == nil {
      detach()
      let interaction = UIScrollEdgeElementContainerInteraction()
      interaction.scrollView = scroll
      interaction.edge = .top
      previousStyle = scroll.topEdgeEffect.style
      previousHidden = scroll.topEdgeEffect.isHidden
      headerHost = host
      boundScrollView = scroll
      edgeInteraction = interaction
      host.addInteraction(interaction)
      scrollObservation = scroll.observe(\.contentOffset, options: [.initial, .new]) { [weak self] _, _ in
        self?.refreshBackdrop(animated: true)
        self?.emitBoundStatus()
      }
    }
    scroll.topEdgeEffect.style = .soft
    scroll.topEdgeEffect.isHidden = false
    refreshBackdrop(animated: false)
    emitBoundStatus()
  }

  private func emitBoundStatus() {
    guard reportStatus, let scroll = boundScrollView, let host = headerHost else { return }
    let viewport = scroll.convert(scroll.bounds, to: host)
    let intersection = host.bounds.intersection(viewport)
    let overlap = intersection.isNull ? 0 : max(0, intersection.height)
    emitStatus(available: true, bound: true, overlap: overlap, code: 0)
  }

  private func findScrollView(in root: UIView) -> UIScrollView? {
    // RN's public scroll host wraps UIScrollView on both rendering paths. BFS
    // chooses the outer viewport before any nested controls or content scrollers.
    var level = [root]
    var visited = 0
    for _ in 0..<6 {
      var next: [UIView] = []
      for view in level {
        visited += 1
        guard visited <= 96 else { return nil }
        if let scroll = view as? UIScrollView { return scroll }
        next.append(contentsOf: view.subviews)
      }
      if next.isEmpty { return nil }
      level = next
    }
    return nil
  }

  private func detach() {
    scrollObservation?.invalidate()
    scrollObservation = nil
    if let interaction = edgeInteraction { headerHost?.removeInteraction(interaction) }
    if #available(iOS 26.0, *), let scroll = boundScrollView {
      if let style = previousStyle as? UIScrollEdgeEffect.Style {
        scroll.topEdgeEffect.style = style
      }
      scroll.topEdgeEffect.isHidden = previousHidden
    }
    edgeInteraction = nil
    headerHost = nil
    boundScrollView = nil
    previousStyle = nil
    refreshBackdrop(animated: false)
  }

  private func emitStatus(available: Bool, bound: Bool, overlap: CGFloat = 0, code: Double) {
    guard reportStatus else { return }
    let status: [String: Double] = ["available": available ? 1 : 0, "bound": bound ? 1 : 0,
      "overlap": Double((overlap * 10).rounded() / 10), "overlaps": overlap > 0 ? 1 : 0, "code": code,
      "backdropActive": backdropRequired == true ? 1 : 0,
      "backdropOpaque": backdropOpaque == true ? 1 : 0]
    guard status != lastStatus else { return }
    lastStatus = status
    onStatus(status)
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? { nil }

  deinit {
    detach()
    NotificationCenter.default.removeObserver(self)
  }
}

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

// Native compact time picker owns its presentation, dismissal and accessibility.
// Treat stored minutes as wall-clock values, independent of DST and travel.
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

// UISlider keeps the native glass thumb, tracking, scroll arbitration and VoiceOver.
final class CalmeraGoalSliderView: ExpoView {
  let onValueChange = EventDispatcher()
  let onSlidingComplete = EventDispatcher()
  var value: Double = 0
  var valueUnset = false
  var minimumValue: Double = 0
  var maximumValue: Double = 100
  var step: Double = 1
  var sliderDisabled = false
  var sliderLabel = "Goal"
  var unit = ""
  // The goal's own color fills the track; a pale wash of it shows the rest.
  var trackColor: UIColor?
  private let slider = UISlider()
  private let tangerine = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    overrideUserInterfaceStyle = .light
    slider.minimumTrackTintColor = tangerine
    slider.maximumTrackTintColor = UIColor(red: 229/255, green: 211/255, blue: 183/255, alpha: 1)
    slider.addTarget(self, action: #selector(changed), for: .valueChanged)
    slider.addTarget(self, action: #selector(completed), for: [.touchUpInside, .touchUpOutside, .touchCancel])
    addSubview(slider)
  }

  func updateControl() {
    let lower = minimumValue.isFinite ? minimumValue : 0
    let upper = maximumValue.isFinite ? max(lower + 1, maximumValue) : lower + 100
    slider.minimumValue = Float(lower)
    slider.maximumValue = Float(upper)
    // A JS echo of a live event must never interrupt the thumb's tracking.
    value = value.isFinite ? value.rounded() : lower.rounded()
    if !slider.isTracking { slider.value = Float(value) }
    slider.isEnabled = !sliderDisabled
    if let trackColor {
      slider.minimumTrackTintColor = trackColor
      slider.maximumTrackTintColor = trackColor.withAlphaComponent(0.2)
    }
    slider.accessibilityLabel = sliderLabel
    updateAccessibleValue()
  }

  private func quantizedValue() -> Double {
    let increment = step.isFinite && step > 0 ? step : 1
    let rounded = minimumValue + ((Double(slider.value) - minimumValue) / increment).rounded() * increment
    return min(maximumValue, max(minimumValue, rounded.rounded()))
  }

  @objc private func changed() {
    // Update VoiceOver immediately; do not wait for the JS value echo.
    valueUnset = false
    value = quantizedValue()
    slider.value = Float(value)
    updateAccessibleValue()
    onValueChange(["value": value])
  }

  @objc private func completed() { onSlidingComplete(["value": value]) }

  private func updateAccessibleValue() {
    slider.accessibilityValue = valueUnset ? "Not set"
      : "\(value.formatted(.number.precision(.fractionLength(0)))) \(unit)"
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    slider.frame = bounds.insetBy(dx: 2, dy: 0)
  }
}
