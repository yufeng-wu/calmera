import ExpoModulesCore

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
