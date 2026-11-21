#!/bin/bash
set -euo pipefail
# Builds the real app (com.yfwu02.calmera, Release) signed by calmera's team and
# installs it on a plugged-in, unlocked iPhone.
# Usage: CALMERA_IPHONE_UDID=<udid> bash scripts/install-iphone.sh
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/scripts/signing-team.sh"
source "$PROJECT_ROOT/scripts/release-hermes.sh"
CALMERA_APPLE_TEAM_ID="${CALMERA_APPLE_TEAM_ID:-$CALMERA_TEAM_ID}"
require_calmera_team "$CALMERA_APPLE_TEAM_ID"
UDID="${CALMERA_IPHONE_UDID:-}"
if [[ ! "$UDID" =~ ^[A-Fa-f0-9-]{16,40}$ ]]; then
  echo "Set CALMERA_IPHONE_UDID to the iPhone's identifier (xcrun devicectl list devices)." >&2
  exit 2
fi
BUILD_ROOT="${CALMERA_PHONE_BUILD_ROOT:-/tmp/calmera-iphone}"
cd "$PROJECT_ROOT"
forget_hermes_configuration "$PROJECT_ROOT"
EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 xcodebuild \
  -workspace ios/mobile.xcworkspace -scheme mobile -configuration Release \
  -sdk iphoneos -destination "platform=iOS,id=$UDID" \
  -derivedDataPath "$BUILD_ROOT/DerivedData" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$CALMERA_APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  build
APP="$BUILD_ROOT/DerivedData/Build/Products/Release-iphoneos/mobile.app"
require_app_signed_by_calmera_team "$APP"
require_release_hermes "$APP"
xcrun devicectl device install app --device "$UDID" "$APP"
