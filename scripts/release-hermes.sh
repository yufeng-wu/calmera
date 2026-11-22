# Sourced by the Release phone build scripts. A Release app must carry the release Hermes engine: the debug one
# (with the Chrome inspector) crashes a Release build at launch, on the JS thread, before any app code runs.
#
# `pod install` unpacks the debug engine, and React Native's "[Hermes] Replace Hermes for the right configuration"
# build phase swaps in the release one only when Pods/.last_build_configuration says the last build was not
# Release. A pod install after a Release build leaves that file saying Release over a debug engine, so the swap is
# skipped (2026-11-21: "Same config of the previous build. No need to replace Hermes engine", and the app crashed).

# Before a Release build: forget the last configuration, so the build phase always installs the release engine.
forget_hermes_configuration() {
  rm -f "$1/ios/Pods/.last_build_configuration"
}

# After a Release build: fails if the app embeds the debug engine.
require_release_hermes() {
  local hermes="$1/Frameworks/hermes.framework/hermes"
  if [[ ! -f "$hermes" ]]; then
    echo "No Hermes engine in $1." >&2
    exit 3
  fi
  if grep -q CDPHandler "$hermes"; then
    echo "Refusing: $1 embeds the debug Hermes engine, which crashes a Release build at launch." >&2
    echo "Delete ios/Pods/.last_build_configuration and build again." >&2
    exit 3
  fi
  echo "Release Hermes engine embedded."
}
