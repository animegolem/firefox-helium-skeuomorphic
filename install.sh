#!/bin/zsh
# helium-slate installer. Idempotent; safe to re-run after Firefox updates.
#   ./install.sh                     install into the default profile + app
#   ./install.sh --profile DIR       install into a specific profile dir
#   ./install.sh --app-only          only re-apply the Firefox.app stub
#   FIREFOX_APP=/path/Firefox.app    override the app bundle
set -euo pipefail
here=${0:A:h}
app=${FIREFOX_APP:-/Applications/Firefox.app}
profile=""
app_only=0
while (( $# )); do
  case $1 in
    --profile) profile=$2; shift 2 ;;
    --app-only) app_only=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

res="$app/Contents/Resources"
mkdir -p "$res/defaults/pref"
for f in defaults/pref/hs-autoconfig.js hs-config.js; do
  if ! cmp -s "$here/app-patch/$f" "$res/$f"; then
    cp "$here/app-patch/$f" "$res/$f"
    echo "app: wrote $res/$f"
  fi
done
(( app_only )) && exit 0

if [[ -z $profile ]]; then
  ini="$HOME/Library/Application Support/Firefox/profiles.ini"
  rel=$(awk -F= '/^\[Install/{s=1;next} /^\[/{s=0} s&&$1=="Default"{print $2; exit}' "$ini")
  profile="$HOME/Library/Application Support/Firefox/$rel"
fi
[[ -d $profile ]] || { echo "no profile at $profile" >&2; exit 1; }

mkdir -p "$profile/chrome"
for f in userChrome.css hs-author.css hs-layout.uc.js chrome.manifest; do
  cp "$here/chrome/$f" "$profile/chrome/$f"
done
echo "profile: updated $profile/chrome"

userjs="$profile/user.js"
touch "$userjs"
for line in \
  'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);' \
  'user_pref("browser.compactmode.show", true);' \
  'user_pref("browser.uidensity", 1);'; do
  grep -qF "$line" "$userjs" || echo "$line" >> "$userjs"
done
