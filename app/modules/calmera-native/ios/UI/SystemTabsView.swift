import ExpoModulesCore

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
