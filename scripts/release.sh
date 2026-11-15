#!/usr/bin/env bash
# Publish a new SLIDE release to GitHub (game zip + manifest + checksum [+ launcher installer]).
#
#   scripts/release.sh patch|minor|major|X.Y.Z [--launcher] [--notes-file FILE] [--draft] [--no-push] [--dry-run]
#
# What it does:
#   1. bumps version.json (the game version players see and the launcher compares against)
#   2. builds release/out/slide-game-<v>.zip, its .sha256 and manifest.json (game web files only, ~7 MB)
#   3. with --launcher: builds the Windows installer (launcher/dist) and records it in release/launcher.json,
#      so every manifest keeps pointing launchers at the newest installer
#   4. commits "Release vX", tags vX, pushes, and runs `gh release create` with the assets
# Release notes come from --notes-file, else the "## vX" section of CHANGELOG.md, else `git log` since the last tag.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="piwadev/slide"
BUMP="${1:-}"; [ -n "$BUMP" ] || { sed -n '2,13p' "$0"; exit 1; }; shift || true
LAUNCHER=0; NOTES_FILE=""; DRAFT=""; PUSH=1; DRY=0
while [ $# -gt 0 ]; do case "$1" in
  --launcher) LAUNCHER=1;; --notes-file) NOTES_FILE="$2"; shift;; --draft) DRAFT="--draft";;
  --no-push) PUSH=0;; --dry-run) DRY=1;; *) echo "unknown option $1"; exit 1;; esac; shift; done

command -v gh >/dev/null || { echo "gh is required"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "run: gh auth login"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean - commit or stash first."; git status --short; exit 1; }

CUR=$(jq -r .version version.json)
IFS=. read -r MA MI PA <<<"$CUR"
case "$BUMP" in patch) NEW="$MA.$MI.$((PA+1))";; minor) NEW="$MA.$((MI+1)).0";; major) NEW="$((MA+1)).0.0";;
  [0-9]*.[0-9]*.[0-9]*) NEW="$BUMP";; *) echo "bad version/bump: $BUMP"; exit 1;; esac
TAG="v$NEW"
git rev-parse "$TAG" >/dev/null 2>&1 && { echo "tag $TAG already exists"; exit 1; }
echo "==> $CUR -> $NEW"

# notes
NOTES=$(mktemp)
if [ -n "$NOTES_FILE" ]; then cp "$NOTES_FILE" "$NOTES"
elif [ -f CHANGELOG.md ] && grep -q "^## v\?$NEW\b" CHANGELOG.md; then awk -v v="$NEW" '$0 ~ "^## v?"v"([^0-9.]|$)"{f=1;next} /^## /{f=0} f' CHANGELOG.md >"$NOTES"
else { echo "## What's new in $NEW"; echo; git log --pretty='- %s' "$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)"..HEAD; } >"$NOTES"; fi
[ -s "$NOTES" ] || echo "Release $NEW" >"$NOTES"

jq --arg v "$NEW" '.version=$v' version.json >version.json.tmp && mv version.json.tmp version.json

if [ "$LAUNCHER" = 1 ]; then
  echo "==> building launcher installer"
  python3 scripts/build-game-zip.py >/dev/null            # bundled first-run copy of this game version
  rm -rf launcher/resources/bundled && mkdir -p launcher/resources/bundled
  cp "release/out/slide-game-$NEW.zip" launcher/resources/bundled/
  SHA=$(cut -d' ' -f1 "release/out/slide-game-$NEW.zip.sha256")
  jq -n --arg v "$NEW" --arg f "slide-game-$NEW.zip" --arg s "$SHA" '{version:$v,file:$f,sha256:$s}' >launcher/resources/bundled/bundled.json
  [ -d launcher/node_modules ] || (cd launcher && npm install --no-audit --no-fund)
  # On Linux/macOS electron-builder needs `wine` to generate the NSIS uninstaller stub (see launcher/README.md)
  if [ "$(uname -s)" != "Linux" ] || command -v wine >/dev/null; then :; else echo "wine not found - needed to build the Windows installer on Linux"; exit 1; fi
  RUN=""; [ -z "${DISPLAY:-}" ] && command -v xvfb-run >/dev/null && RUN="xvfb-run -a"
  (cd launcher && $RUN npm run dist)
  INST="launcher/dist/SLIDE-Launcher-Setup.exe"
  LV=$(jq -r .version launcher/package.json)
  jq -n --arg v "$LV" --arg u "https://github.com/$REPO/releases/download/$TAG/SLIDE-Launcher-Setup.exe" \
        --arg s "$(sha256sum "$INST" | cut -d' ' -f1)" --argjson z "$(stat -c%s "$INST")" \
        '{version:$v,file:"SLIDE-Launcher-Setup.exe",url:$u,sha256:$s,size:$z}' >release/launcher.json
fi

python3 scripts/build-game-zip.py --notes-file "$NOTES"
ASSETS=("release/out/slide-game-$NEW.zip" "release/out/slide-game-$NEW.zip.sha256" "release/out/manifest.json")
[ "$LAUNCHER" = 1 ] && ASSETS+=("launcher/dist/SLIDE-Launcher-Setup.exe")

if [ "$DRY" = 1 ]; then echo "==> dry run: would publish $TAG with:"; printf '   %s\n' "${ASSETS[@]}"; echo "--- notes ---"; cat "$NOTES"; git checkout -- version.json; git ls-files --error-unmatch release/launcher.json >/dev/null 2>&1 && git checkout -- release/launcher.json || rm -f release/launcher.json; exit 0; fi

git add -A && git commit -qm "Release $TAG" && git tag -a "$TAG" -m "SLIDE $NEW"
if [ "$PUSH" = 1 ]; then git push origin HEAD "$TAG"; fi
gh release create "$TAG" "${ASSETS[@]}" --repo "$REPO" --title "SLIDE $NEW" --notes-file "$NOTES" --verify-tag $DRAFT
echo "==> published: https://github.com/$REPO/releases/tag/$TAG"
