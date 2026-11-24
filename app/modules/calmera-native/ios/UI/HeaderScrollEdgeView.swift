import ExpoModulesCore

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
