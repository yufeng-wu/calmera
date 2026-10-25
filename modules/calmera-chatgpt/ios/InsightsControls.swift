import ExpoModulesCore
import UIKit

// System segmented control: on iOS 26 it is Liquid Glass and slides its
// selection with the native spring.
final class CalmeraSegmentedView: ExpoView {
  let onChange = EventDispatcher()
  private let control = UISegmentedControl()
  private var items: [String] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    overrideUserInterfaceStyle = .light
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
    let ink = UIColor(red: 74/255, green: 52/255, blue: 40/255, alpha: 1)
    let muted = UIColor(red: 120/255, green: 104/255, blue: 94/255, alpha: 1)
    control.setTitleTextAttributes([.font: UIFont.systemFont(ofSize: 15, weight: .semibold), .foregroundColor: ink], for: .selected)
    control.setTitleTextAttributes([.font: UIFont.systemFont(ofSize: 15, weight: .medium), .foregroundColor: muted], for: .normal)
    addSubview(control)
  }

  func setItems(_ value: [String]) {
    guard value != items else { return }
    items = value
    let selected = control.selectedSegmentIndex
    control.removeAllSegments()
    for (index, title) in value.enumerated() { control.insertSegment(withTitle: title, at: index, animated: false) }
    control.selectedSegmentIndex = selected < value.count ? max(selected, 0) : 0
  }

  func select(_ index: Int) {
    guard index >= 0, index < control.numberOfSegments, control.selectedSegmentIndex != index else { return }
    control.selectedSegmentIndex = index
  }

  @objc private func changed() { onChange(["index": control.selectedSegmentIndex]) }

  override func layoutSubviews() {
    super.layoutSubviews()
    control.frame = bounds
  }
}

// Round glass button that opens a native menu (Liquid Glass on iOS 26).
// items: [{ id, title, symbol, checked: "1" }]
final class CalmeraGlassMenuView: ExpoView {
  let onSelect = EventDispatcher()
  var symbol = "plus" { didSet { update() } }
  var label = "" { didSet { update() } }
  var items: [[String: String]] = [] { didSet { update() } }
  private let button = UIButton(type: .system)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    overrideUserInterfaceStyle = .light
    button.showsMenuAsPrimaryAction = true
    if #available(iOS 16.0, *) { button.preferredMenuElementOrder = .fixed }
    addSubview(button)
    update()
  }

  private func update() {
    var config: UIButton.Configuration
    if #available(iOS 26.0, *), !UIAccessibility.isReduceTransparencyEnabled { config = .glass() } else { config = .plain() }
    config.image = UIImage(systemName: symbol)
    config.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)
    config.baseForegroundColor = UIColor(red: 74/255, green: 52/255, blue: 40/255, alpha: 1)
    config.cornerStyle = .capsule
    button.configuration = config
    if #available(iOS 26.0, *) { button.cornerConfiguration = .capsule() }
    button.accessibilityLabel = label
    button.menu = UIMenu(children: items.map { item in
      let id = item["id"] ?? ""
      return UIAction(title: item["title"] ?? id, image: (item["symbol"]).flatMap { UIImage(systemName: $0) },
        state: item["checked"] == "1" ? .on : .off) { [weak self] _ in self?.onSelect(["id": id]) }
    })
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }
}
