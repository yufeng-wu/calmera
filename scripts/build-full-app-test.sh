#!/bin/bash
set -euo pipefail
# Full original UI Release test build with its own app ID. No install/upload/account changes.
PROJECT_ROOT="${CALMERA_PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
MODE="${1:-signed}"
if [[ $# -gt 1 || ! "$MODE" =~ ^(signed|--unsigned-check|--simulator|--prepare-only)$ ]]; then
  echo "Usage: bash scripts/build-full-app-test.sh [--unsigned-check|--simulator|--prepare-only]" >&2
  exit 2
fi
if [[ "$MODE" == signed ]] && [[ -z "${CALMERA_APPLE_TEAM_ID:-}" || ! "$CALMERA_APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "Signing is required for installation. Set CALMERA_APPLE_TEAM_ID after configuring Xcode signing." >&2
  exit 2
fi
BUILD_ROOT="${CALMERA_TEST_BUILD_ROOT:-/tmp/calmera-full-app-test}"
mkdir -p "$BUILD_ROOT"
python3 - "$PROJECT_ROOT" "$BUILD_ROOT" <<'PYTHON'
import pathlib, plistlib, sys
project, build = map(pathlib.Path, sys.argv[1:])
with (project/'ios/mobile/Info.plist').open('rb') as f:
    info=plistlib.load(f)
info['CFBundleDisplayName']='Calmera Test'
info['CFBundleURLTypes']=[{'CFBundleURLSchemes':['calmera-chatgpt-dev','com.yfwu02.mobile.chatgptdev']}]
with (build/'PhoneTest-Info.plist').open('wb') as f:
    plistlib.dump(info,f)
with (build/'PhoneTest.entitlements').open('wb') as f:
    plistlib.dump({},f)
PYTHON
if [[ "$MODE" == --prepare-only ]]; then
  echo "Prepared separate test app metadata. No build or signing."
  exit 0
fi
SDK=iphoneos
DESTINATION='generic/platform=iOS'
SIGNING=(CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="${CALMERA_APPLE_TEAM_ID:-}")
set --
if [[ "$MODE" == signed && "${CALMERA_ALLOW_PROVISIONING_UPDATES:-0}" == 1 ]]; then
  set -- -allowProvisioningUpdates
  if [[ -n "${CALMERA_IPHONE_UDID:-}" ]]; then
    if [[ ! "$CALMERA_IPHONE_UDID" =~ ^[A-Fa-f0-9-]{16,40}$ ]]; then
      echo "Invalid development-device identifier." >&2
      exit 2
    fi
    DESTINATION="platform=iOS,id=$CALMERA_IPHONE_UDID"
    set -- "$@" -allowProvisioningDeviceRegistration
  fi
fi
if [[ "$MODE" == --unsigned-check ]]; then
  SIGNING=(CODE_SIGNING_ALLOWED=NO)
elif [[ "$MODE" == --simulator ]]; then
  SDK=iphonesimulator
  DESTINATION='generic/platform=iOS Simulator'
  SIGNING=(CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= "ARCHS=$(uname -m)")
fi
cd "$PROJECT_ROOT"
CALMERA_FULL_APP_TEST=1 ENTRY_FILE="$PROJECT_ROOT/node_modules/expo-router/entry.js" EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 xcodebuild \
  -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release \
  -sdk "$SDK" -destination "$DESTINATION" -derivedDataPath "$BUILD_ROOT/DerivedData" \
  "${SIGNING[@]}" "$@" ONLY_ACTIVE_ARCH=YES \
  PRODUCT_BUNDLE_IDENTIFIER=com.yfwu02.mobile.chatgptdev \
  INFOPLIST_FILE="$BUILD_ROOT/PhoneTest-Info.plist" \
  CODE_SIGN_ENTITLEMENTS="$BUILD_ROOT/PhoneTest.entitlements" \
  build
APP="$BUILD_ROOT/DerivedData/Build/Products/Release-$SDK/mobile.app"
python3 - "$APP" <<'PYTHON'
import pathlib, plistlib, sys
app=pathlib.Path(sys.argv[1])
info=plistlib.loads((app/'Info.plist').read_bytes())
assert info['CFBundleIdentifier']=='com.yfwu02.mobile.chatgptdev'
assert info['CFBundleDisplayName']=='Calmera Test'
assert (app/'main.jsbundle').stat().st_size>0, 'Missing standalone JS bundle'
print('Full-UI test app built with an embedded JS bundle. No app was installed.')
PYTHON
