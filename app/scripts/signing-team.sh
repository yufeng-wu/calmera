# Sourced by the phone build scripts. calmera is always signed by the owner's
# paid team; any other team is refused before and after the build.
CALMERA_TEAM_ID=2G2578H6DX

# Fails unless the given team ID is calmera's team.
require_calmera_team() {
  if [[ "${1:-}" != "$CALMERA_TEAM_ID" ]]; then
    echo "Refusing to sign with team '${1:-none}'. calmera is signed only by team $CALMERA_TEAM_ID (Yufeng Wu, paid)." >&2
    echo "Pick that team in Xcode > Settings > Apple Accounts, or unset CALMERA_APPLE_TEAM_ID." >&2
    exit 2
  fi
}

# Fails unless the built app was actually signed by calmera's team.
require_app_signed_by_calmera_team() {
  local team
  team="$(codesign -dv "$1" 2>&1 | sed -n 's/^TeamIdentifier=//p')"
  require_calmera_team "$team"
  echo "Signed by team $team: $(codesign -dvv "$1" 2>&1 | sed -n 's/^Authority=//p' | head -1)"
}
