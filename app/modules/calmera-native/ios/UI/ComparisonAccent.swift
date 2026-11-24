import UIKit

// Comparison tint is opt-in and restricted to the separate simulator test app.
// Production callers retain Tangerine until the user chooses a new palette.
func comparisonAccent(_ id: String) -> UIColor {
  if id == "basil" && Bundle.main.bundleIdentifier == "com.yfwu02.calmera.chatgptdev" {
    return UIColor(red: 53/255, green: 92/255, blue: 69/255, alpha: 1)
  }
  return UIColor(red: 188/255, green: 90/255, blue: 25/255, alpha: 1)
}
