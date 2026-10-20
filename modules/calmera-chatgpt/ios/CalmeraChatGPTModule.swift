import ExpoModulesCore
import AVFoundation

public final class CalmeraChatGPTModule: Module {
  private let callback = PlanLoopback()
  private let picker = PlanPhotoPicker()

  public func definition() -> ModuleDefinition {
    Name("CalmeraChatGPT")
    View(CalmeraGlassView.self) {}
    View(CalmeraFormButtonView.self) {
      ViewName("FormButton")
      Events("onPress")
      Prop("title") { (view: CalmeraFormButtonView, value: String) in view.buttonTitle = value }
      Prop("symbol") { (view: CalmeraFormButtonView, value: String) in view.symbol = value }
      Prop("buttonRole") { (view: CalmeraFormButtonView, value: String) in view.buttonRole = value }
      Prop("buttonLabel") { (view: CalmeraFormButtonView, value: String) in view.buttonLabel = value }
      Prop("buttonDisabled") { (view: CalmeraFormButtonView, value: Bool) in view.buttonDisabled = value }
      Prop("loading") { (view: CalmeraFormButtonView, value: Bool) in view.loading = value }
      OnViewDidUpdateProps { (view: CalmeraFormButtonView) in view.updateControl() }
    }
    View(CalmeraGoalSliderView.self) {
      ViewName("GoalSlider")
      Events("onValueChange", "onSlidingComplete")
      Prop("value") { (view: CalmeraGoalSliderView, value: Double) in view.value = value }
      Prop("minimumValue") { (view: CalmeraGoalSliderView, value: Double) in view.minimumValue = value }
      Prop("maximumValue") { (view: CalmeraGoalSliderView, value: Double) in view.maximumValue = value }
      Prop("step") { (view: CalmeraGoalSliderView, value: Double) in view.step = value }
      Prop("sliderDisabled") { (view: CalmeraGoalSliderView, value: Bool) in view.sliderDisabled = value }
      Prop("sliderLabel") { (view: CalmeraGoalSliderView, value: String) in view.sliderLabel = value }
      Prop("unit") { (view: CalmeraGoalSliderView, value: String) in view.unit = value }
      OnViewDidUpdateProps { (view: CalmeraGoalSliderView) in view.updateControl() }
    }
    View(CalmeraMealActionsView.self) {
      ViewName("MealActions")
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
      Events("onSelect")
      Prop("selectedIndex") { (view: CalmeraSystemTabsView, index: Int) in
        view.select(index)
      }
    }
    View(CalmeraActionMenuView.self) {
      ViewName("ActionMenu")
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
    AsyncFunction("voiceClipMetadata") { (uri: String) async throws -> [String: Double] in
      // Only the just-recorded app-owned cache clip; never enumerate files.
      let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("AV", isDirectory: true).resolvingSymlinksInPath().standardizedFileURL
      guard let url = URL(string: uri), url.isFileURL,
        url.resolvingSymlinksInPath().standardizedFileURL.path.hasPrefix(cache.path + "/") else {
        throw NSError(domain: "CalmeraVoice", code: 1, userInfo: [NSLocalizedDescriptionKey: "invalid_voice_clip"])
      }
      let asset = AVURLAsset(url: url)
      let duration = try await asset.load(.duration)
      let seconds = CMTimeGetSeconds(duration)
      let bytes = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
      return ["durationMs": seconds.isFinite ? max(0, seconds * 1000) : 0, "byteCount": Double(bytes)]
    }

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
    material.layer.cornerRadius = min(bounds.height / 2, 32)
    material.clipsToBounds = true
  }

  deinit { NotificationCenter.default.removeObserver(self) }
}


// UIKit owns the tab buttons, selection lens and horizontal scrubbing gesture.
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
      ("History", "calendar", "calendar"),
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

  func select(_ index: Int) {
    guard (0..<3).contains(index) else { return }
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
  private var priorExpanded: Bool?
  private var priorRecording = false
  private var priorAnalyzing = false
  private var lastBounds = CGRect.zero
  private var visible = [false, false, false, true]
  private var voiceAnimator: UIViewPropertyAnimator?
  private var voiceReturnLink: CADisplayLink?
  private var voiceReturnGeneration = 0
  private var voiceReturnSamples = 0
  private var voiceReturnMaxAnchorError: CGFloat = 0
  private var voiceReturnBadSamples = 0
  private var voiceReturnStartWidth: CGFloat = 0
  private let tint = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
  private var itemHeight: CGFloat { max(48, UIFontMetrics(forTextStyle: .body).scaledValue(for: 48)) }
  private var triggerHeight: CGFloat { max(56, UIFontMetrics(forTextStyle: .body).scaledValue(for: 56)) }
  private var triggerWidth: CGFloat {
    if expanded { return triggerHeight }
    return max(84, labels[3].intrinsicContentSize.width + 52)
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
    let titles = ["Photo", "Manual", "Voice", "Add"]
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
      button.accessibilityLabel = ["Log a meal from a photo", "Add a meal with text", "Hold to log a meal by voice", "Add a meal"][index]
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
      icon.contentMode = .scaleAspectFit
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
      label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .semibold))
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
      if index == 2 {
        let hold = UILongPressGestureRecognizer(target: self, action: #selector(voiceHold(_:)))
        hold.minimumPressDuration = 0.45
        hold.cancelsTouchesInView = true
        button.addGestureRecognizer(hold)
        button.accessibilityHint = "Press and hold while speaking, then release to save."
      }
      container.contentView.addSubview(glass)
      glasses.append(glass); buttons.append(button); rows.append(row); labels.append(label); icons.append(icon)
    }
    let dismiss = UITapGestureRecognizer(target: self, action: #selector(backgroundTapped))
    dismiss.delegate = self
    addGestureRecognizer(dismiss)
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIContentSizeCategory.didChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.darkerSystemColorsStatusDidChangeNotification, object: nil)
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
    for label in labels {
      label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .semibold))
    }
    priorExpanded = nil
    render()
  }

  private func material(for index: Int) -> UIVisualEffect? {
    if UIAccessibility.isReduceTransparencyEnabled { return nil }
    if #available(iOS 26.0, *) {
      // The compact Add affordance can be clearer; longer option/recording
      // labels keep regular material. Increase Contrast strengthens Add too.
      let clearAdd = index == 3 && !UIAccessibility.isDarkerSystemColorsEnabled
      let glass = UIGlassEffect(style: clearAdd ? .clear : .regular)
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
    let changed = force || priorExpanded != expanded || priorRecording != recording || priorAnalyzing != analyzing
    labels[2].text = analyzing ? "Processing…" : recording ? "\(seconds)s · Release" : "Voice"
    icons[2].image = analyzing ? nil : UIImage(systemName: recording ? "waveform" : "mic")
    if analyzing { processingIndicator.startAnimating() } else { processingIndicator.stopAnimating() }
    buttons[2].accessibilityValue = analyzing ? "Processing your meal" : recording ? "Recording" : nil
    // Never animate UIStackView.isHidden: interrupted hide animations can leave a plus-only button.
    labels[3].isHidden = false
    buttons[2].isEnabled = !analyzing
    buttons[3].isEnabled = !recording
    buttons[3].accessibilityLabel = expanded ? "Close add meal menu" : "Add a meal"
    accessibilityViewIsModal = expanded
    for index in 0..<4 {
      let textWidth = ceil(((labels[index].text ?? "") as NSString).size(withAttributes: [.font: labels[index].font!]).width)
      rowWidths[index].constant = index == 3 && expanded ? 20 : 20 + (index == 3 ? 4 : rows[index].spacing) + textWidth
    }
    visible = [expanded, expanded, expanded || recording || analyzing, true]
    for index in 0..<4 {
      glasses[index].accessibilityElementsHidden = !visible[index]
      buttons[index].isUserInteractionEnabled = visible[index] && !(recording && index < 2)
    }
    if !changed { glasses[2].layoutIfNeeded(); return }
    stopVoiceGrowth()
    let startsRecording = recording && !priorRecording
    let releasesRecording = priorRecording && !recording
    let returnGeneration: Int? = releasesRecording ? beginVoiceReturnCheck() : nil
    priorExpanded = expanded; priorRecording = recording; priorAnalyzing = analyzing
    let trigger = frame(for: 3, width: triggerWidth)
    if first {
      for glass in glasses { glass.frame = trigger }
    }
    let longestTitle = ["Photo", "Manual", "Voice"].map {
      ($0 as NSString).size(withAttributes: [.font: labels[0].font!]).width
    }.max() ?? 0
    let width = min(max(optionWidth, ceil(longestTitle) + 62), bounds.width - 40)
    let update = {
      for index in 0..<4 {
        let show = self.visible[index]
        let processingWidth = min(self.bounds.width - 40, max(width, self.rowWidths[2].constant + 32))
        let targetWidth = index == 3 ? self.triggerWidth : index == 2 && self.analyzing ? processingWidth : width
        self.glasses[index].frame = index == 3 || show ? self.frame(for: index, width: targetWidth) : trigger
        if #unavailable(iOS 26.0) {
          self.glasses[index].layer.cornerRadius = (index == 3 ? self.triggerHeight : self.itemHeight) / 2
        }
        // A recording/processing label change is not a new glass element.
        // Keep its material identity; replacing it during a frame animation can
        // trigger an unrelated container materialization from a default origin.
        if first || previousVisibility[index] != show {
          self.glasses[index].effect = show ? self.material(for: index) : nil
        }
        self.glasses[index].backgroundColor = show && UIAccessibility.isReduceTransparencyEnabled ? .secondarySystemGroupedBackground : .clear
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
          self?.settleTriggerTitle()
          if let returnGeneration { self?.finishVoiceReturnCheck(returnGeneration) }
        })
    } else {
      update(); settleTriggerTitle()
      if let returnGeneration { finishVoiceReturnCheck(returnGeneration) }
    }
    if startsRecording { growVoice() }
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
      metrics[key + "Left"] = Double(rows[index].frame.minX)
      metrics[key + "Right"] = Double(buttons[index].bounds.width - rows[index].frame.maxX)
    }
    metrics["addTitleVisible"] = !labels[3].isHidden && labels[3].alpha > 0.99 && (triggerTitleWidth?.constant ?? 0) > 0 ? 1 : 0
    metrics["processing"] = analyzing ? 1 : 0
    metrics["voiceHeight"] = Double(glasses[2].bounds.height)
    if motionDiagnostics {
      metrics["voiceReturnSamples"] = Double(voiceReturnSamples)
      metrics["voiceReturnBadSamples"] = Double(voiceReturnBadSamples)
      metrics["voiceReturnMaxAnchorError"] = Double(voiceReturnMaxAnchorError)
      metrics["voiceReturnStartWidth"] = Double(voiceReturnStartWidth)
      metrics["voiceRight"] = Double(glasses[2].frame.maxX)
      metrics["voiceTop"] = Double(glasses[2].frame.minY)
    }
    onMetrics(metrics)
  }

  private func stopVoiceGrowth() {
    guard let animator = voiceAnimator else { return }
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

  private func growVoice() {
    let firstWidth = min(max(glasses[2].bounds.width, optionWidth + 40), bounds.width - 40)
    if UIAccessibility.isReduceMotionEnabled {
      glasses[2].frame = frame(for: 2, width: firstWidth)
      glasses[2].layoutIfNeeded()
      return
    }
    let phase = UIViewPropertyAnimator(duration: 0.22, dampingRatio: 0.85) {
      self.glasses[2].frame = self.frame(for: 2, width: firstWidth)
      self.glasses[2].layoutIfNeeded()
    }
    phase.addCompletion { [weak self] position in
      guard let self, position == .end, self.recording else { return }
      let grow = UIViewPropertyAnimator(duration: 30, curve: .easeOut) {
        self.glasses[2].frame = self.frame(for: 2, width: min(self.bounds.width - 40, self.bounds.width * 0.7))
        self.glasses[2].layoutIfNeeded()
      }
      self.voiceAnimator = grow
      grow.startAnimation()
    }
    voiceAnimator = phase
    phase.startAnimation()
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

  @objc private func voiceHold(_ gesture: UILongPressGestureRecognizer) {
    if gesture.state == .began && !analyzing && !recording {
      onAction(["action": "voiceStart"])
    } else if gesture.state == .ended || gesture.state == .cancelled || gesture.state == .failed {
      if recording {
        recording = false
        analyzing = true
        render()
      }
      onAction(["action": "voiceEnd"])
    }
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
// Geometry and glass material converge to zero before the row's hidden state.
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
  private var effectAnimator: UIViewPropertyAnimator?
  private var configurationKey = ""
  private var lastMetrics: [String: Double] = [:]
  private var lastProgressBucket = -1
  private let editTint = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)

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
    for index in 0..<2 {
      let material = UIVisualEffectView(effect: nil)
      material.clipsToBounds = false
      material.layer.cornerRadius = 28
      material.layer.cornerCurve = .continuous
      if #available(iOS 26.0, *) { material.cornerConfiguration = .capsule(maximumRadius: 28) }
      let button = UIButton(type: .system)
      button.tag = index
      button.configuration = .plain()
      button.accessibilityLabel = index == 0 ? "Edit meal" : "Delete meal"
      button.addAction(UIAction(title: index == 0 ? "Edit" : "Delete",
        attributes: index == 0 ? [] : .destructive) { [weak self] _ in
          self?.onAction(["action": index == 0 ? "edit" : "delete"])
        }, for: .touchUpInside)
      let label = UILabel()
      label.text = index == 0 ? "Edit" : "Delete"
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
    let key = traitCollection.preferredContentSizeCategory.rawValue + "-\(opaque)-\(UIAccessibility.isDarkerSystemColorsEnabled)"
    if key != configurationKey {
      configurationKey = key
      effectAnimator?.stopAnimation(true)
      effectAnimator = nil
      if #available(iOS 26.0, *), !opaque {
        let group = UIGlassContainerEffect()
        // Separate at the final 8pt gap; merge naturally while retracting.
        group.spacing = 6
        container.effect = group
      } else { container.effect = nil }
      let font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .medium), compatibleWith: traitCollection)
      for (index, material) in materials.enumerated() {
        material.effect = nil
        material.backgroundColor = opaque ? .secondarySystemGroupedBackground : .clear
        let color: UIColor = index == 0 ? editTint : .systemRed
        buttons[index].tintColor = color
        labels[index].font = font
        labels[index].textColor = color
      }
      if !opaque {
        let effects: [UIVisualEffect] = materials.map { _ in
          if #available(iOS 26.0, *) {
            let glass = UIGlassEffect(style: .regular)
            glass.isInteractive = true
            return glass
          }
          return UIBlurEffect(style: .systemMaterial)
        }
        // Scrub the real material, not alpha on its compositing ancestor.
        let animator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [weak self] in
          guard let self else { return }
          for (index, material) in self.materials.enumerated() { material.effect = effects[index] }
        }
        animator.pausesOnCompletion = true
        animator.startAnimation()
        animator.pauseAnimation()
        effectAnimator = animator
      }
    }
    setNeedsLayout()
    renderProgress()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    container.frame = bounds
    renderProgress()
  }

  private func renderProgress() {
    guard materials.count == 2 else { return }
    let p = min(1, max(0, revealProgress))
    let fullHeight = max(0, bounds.height - 2 * effectOutset)
    let anchor = effectOutset + 2 * buttonWidth + 8
    let visibleWidth = buttonWidth * p
    let visibleHeight = fullHeight * p
    let labelPhase = min(1, max(0, (p - 0.45) / 0.45))
    let labelOpacity = labelPhase * labelPhase * (3 - 2 * labelPhase)
    effectAnimator?.fractionComplete = p
    for (index, material) in materials.enumerated() {
      // Both droplets share one right-edge seed. Separation accelerates later
      // than size, keeping real overlapping glass until near the open state.
      let spread = (buttonWidth + 8) * p * p
      let originX = anchor - visibleWidth - CGFloat(1 - index) * spread
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
        "materialProgress": Double((p * 1000).rounded() / 1000), "sharedGlassContainer": glass]
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
    effectAnimator?.stopAnimation(true)
    NotificationCenter.default.removeObserver(self)
  }
}


// Standard UIKit glass buttons, shared by custom-header form screens.
// No opacity/scale animation around material; UIKit supplies its own press effect.
final class CalmeraFormButtonView: ExpoView {
  let onPress = EventDispatcher()
  var buttonTitle = ""
  var symbol = ""
  var buttonRole = "default"
  var buttonLabel = ""
  var buttonDisabled = false
  var loading = false
  private let button = UIButton(type: .system)
  private let tint = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)

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
    let opaque = UIAccessibility.isReduceTransparencyEnabled
    var config: UIButton.Configuration
    if #available(iOS 26.0, *), !opaque { config = prominent ? .prominentGlass() : .glass() }
    else {
      config = .filled()
      config.baseBackgroundColor = prominent ? tint : .secondarySystemGroupedBackground
    }
    config.baseBackgroundColor = prominent ? tint : config.baseBackgroundColor
    let foreground: UIColor = buttonDisabled && !loading ? .tertiaryLabel : (buttonRole == "destructive" ? .systemRed : (prominent ? .white : tint))
    config.baseForegroundColor = foreground
    config.imageColorTransformer = UIConfigurationColorTransformer { _ in foreground }
    config.activityIndicatorColorTransformer = UIConfigurationColorTransformer { _ in foreground }
    config.cornerStyle = .capsule
    config.title = buttonTitle.isEmpty ? nil : buttonTitle
    config.image = symbol.isEmpty ? nil : UIImage(systemName: symbol)
    config.imagePadding = buttonTitle.isEmpty ? 0 : 8
    config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(textStyle: .body, scale: .medium)
    config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: buttonTitle.isEmpty ? 0 : 12,
      bottom: 8, trailing: buttonTitle.isEmpty ? 0 : 12)
    let font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 14, weight: .semibold), compatibleWith: traitCollection)
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = font
      return outgoing
    }
    config.showsActivityIndicator = loading
    button.tintColor = tint
    button.configuration = config
    button.isEnabled = !buttonDisabled && !loading
    button.accessibilityLabel = buttonLabel.isEmpty ? buttonTitle : buttonLabel
    button.accessibilityValue = loading ? "Processing" : nil
    button.titleLabel?.adjustsFontForContentSizeCategory = true
    button.titleLabel?.numberOfLines = 2
    button.titleLabel?.textAlignment = .center
    if #available(iOS 26.0, *) { button.cornerConfiguration = .capsule() }
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }
  deinit { NotificationCenter.default.removeObserver(self) }
}

// UISlider keeps the native glass thumb, tracking, scroll arbitration and VoiceOver.
final class CalmeraGoalSliderView: ExpoView {
  let onValueChange = EventDispatcher()
  let onSlidingComplete = EventDispatcher()
  var value: Double = 0
  var minimumValue: Double = 0
  var maximumValue: Double = 100
  var step: Double = 1
  var sliderDisabled = false
  var sliderLabel = "Goal"
  var unit = ""
  private let slider = UISlider()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    overrideUserInterfaceStyle = .light
    slider.minimumTrackTintColor = UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
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
    slider.accessibilityLabel = sliderLabel
    updateAccessibleValue()
  }

  private func quantizedValue() -> Double {
    let increment = step.isFinite && step > 0 ? step : 1
    let rounded = minimumValue + ((Double(slider.value) - minimumValue) / increment).rounded() * increment
    return min(maximumValue, max(minimumValue, rounded.rounded()))
  }

  @objc private func changed() {
    value = quantizedValue()
    slider.value = Float(value)
    updateAccessibleValue()
    onValueChange(["value": value])
  }

  @objc private func completed() { onSlidingComplete(["value": value]) }

  private func updateAccessibleValue() {
    slider.accessibilityValue = "\(value.formatted(.number.precision(.fractionLength(0)))) \(unit)"
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    slider.frame = bounds.insetBy(dx: 2, dy: 0)
  }
}
