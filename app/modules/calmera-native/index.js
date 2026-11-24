// The one place app code reaches Calmera's own native code. The Swift module in
// ios/ registers every view and function below under one Expo module name.
import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";

const MODULE_NAME = "CalmeraNative";

// A native view by its ViewName in the Swift module definition, such as
// "SystemTabs" or "GoalSlider". With no name: the decorative glass material.
export function requireCalmeraNativeView(viewName) {
  return requireNativeViewManager(MODULE_NAME, viewName);
}

// The module's functions (the ChatGPT sign-in callback, the identity check and
// the photo picker), or null when the native build does not include them.
export function requireCalmeraNativeModule() {
  return requireOptionalNativeModule(MODULE_NAME);
}
