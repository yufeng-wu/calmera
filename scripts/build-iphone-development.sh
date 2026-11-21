#!/bin/bash
set -euo pipefail
# Local build only. Never installs, uploads sources or modifies the original app.
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREPARE_ONLY=false
if [[ "${1:-}" == "--prepare-only" && $# -eq 1 ]]; then
  PREPARE_ONLY=true
elif [[ $# -ne 0 ]]; then
  echo "Usage: bash scripts/build-iphone-development.sh [--prepare-only]" >&2
  exit 2
fi
if [[ "$PREPARE_ONLY" == false ]] && [[ -z "${CALMERA_APPLE_TEAM_ID:-}" || ! "$CALMERA_APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "Set CALMERA_APPLE_TEAM_ID to your Apple development team ID (Xcode > Signing & Capabilities)." >&2
  exit 2
fi
BUILD_ROOT="${CALMERA_PHONE_BUILD_ROOT:-/tmp/calmera-iphone-development}"
mkdir -p "$BUILD_ROOT"
python3 - "$PROJECT_ROOT" "$BUILD_ROOT" <<'PYTHON'
import plistlib, pathlib, sys
project, build = map(pathlib.Path, sys.argv[1:])
with (project / 'ios/mobile/Info.plist').open('rb') as f:
    info = plistlib.load(f)
info['CFBundleDisplayName'] = 'foodwrap.'
info['CFBundleURLTypes'] = [{'CFBundleURLSchemes': ['calmera-chatgpt-dev', 'com.yfwu02.calmera.chatgptdev']}]
with (build / 'CalmeraTest-Info.plist').open('wb') as f:
    plistlib.dump(info, f)
with (build / 'CalmeraTest.entitlements').open('wb') as f:
    plistlib.dump({}, f)
PYTHON
if [[ "$PREPARE_ONLY" == true ]]; then
  echo "Prepared foodwrap test Info.plist and entitlements only. No build, signing or installation."
  exit 0
fi
cd "$PROJECT_ROOT"
EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 xcodebuild \
  -workspace ios/mobile.xcworkspace -scheme mobile -configuration Debug \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_ROOT/DerivedData" \
  DEVELOPMENT_TEAM="$CALMERA_APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  PRODUCT_BUNDLE_IDENTIFIER=com.yfwu02.calmera.chatgptdev \
  INFOPLIST_FILE="$BUILD_ROOT/CalmeraTest-Info.plist" \
  CODE_SIGN_ENTITLEMENTS="$BUILD_ROOT/CalmeraTest.entitlements" \
  build
echo "Built foodwrap test with a separate bundle ID; no app was installed."
