import ExpoModulesCore

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
