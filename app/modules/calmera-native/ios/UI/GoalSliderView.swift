import ExpoModulesCore

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
