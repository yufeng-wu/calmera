import ExpoModulesCore

public final class CalmeraNativeModule: Module {
  private let callback = ChatGPTSignIn()
  private let picker = PhotoPicker()

  public func definition() -> ModuleDefinition {
    Name("CalmeraNative")
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
      try await ChatGPTIdentity.fetchAndVerify(token, clientID: clientID, nonce: nonce, priorSubject: subject)
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
