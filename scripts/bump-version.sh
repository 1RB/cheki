#!/bin/bash
# Bump the version in every package and SDK constant, then tag the release.
#
# Usage:
#   ./scripts/bump-version.sh <X.Y.Z>               bump, commit, tag and push main (clean, up-to-date main)
#   ./scripts/bump-version.sh --files-only <X.Y.Z>  only rewrite the version lines (for a release PR; any branch)
#   ./scripts/bump-version.sh --tag-only <X.Y.Z>    tag a main that already carries X.Y.Z (after the release PR merged)
#   add --yes to skip the confirmation prompt (CI, scripted releases)
#
# Release PR flow (main is protected, merge commits only):
#   1. On a branch: ./scripts/bump-version.sh --files-only 1.5.0, add the
#      "## 1.5.0" entries to CHANGELOG.md and sdks/dart/CHANGELOG.md, open a PR.
#   2. After it merges: git checkout main && git pull && ./scripts/bump-version.sh --tag-only 1.5.0
#
# Either way two annotated tags land on the same commit, pushed atomically:
#   vX.Y.Z           triggers .github/workflows/publish.yml (npm, GitHub Packages,
#                    PyPI, Packagist, pub.dev, Go proxy warm-up, registry check)
#   sdks/go/vX.Y.Z   the Go module version (a module in a subdirectory is tagged
#                    with its path prefix); it triggers nothing on its own
# Never move or delete a pushed tag. See docs/RELEASING.md.

set -euo pipefail

MODE="full"
ASSUME_YES=0
NEW_VERSION=""
for arg in "$@"; do
  case "$arg" in
    --files-only) MODE="files" ;;
    --tag-only) MODE="tag" ;;
    --yes|-y) ASSUME_YES=1 ;;
    -*) echo "Unknown option $arg"; exit 1 ;;
    *) NEW_VERSION="$arg" ;;
  esac
done

if [ -z "$NEW_VERSION" ]; then
  sed -n '2,8p' "$0"
  exit 1
fi
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must be X.Y.Z (got '$NEW_VERSION')."
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

# Every file that carries the release version, with a pattern that must match
# exactly the new version afterwards. tests/sdk/version-sync.test.ts checks the
# same list in CI. composer.json has no "version" on purpose: Packagist takes
# the version from the git tag.
VERSIONED_FILES=(
  package.json
  package-lock.json
  sdks/typescript/package.json
  sdks/typescript/src/index.ts
  sdks/typescript/index.js
  python/pyproject.toml
  python/cheki/_version.py
  sdks/php/src/VerifyOptions.php
  sdks/dart/pubspec.yaml
  sdks/dart/lib/src/cheki_client.dart
  sdks/go/cheki.go
  sdks/go/README.md
)

check_changelogs() {
  local missing=0
  for f in CHANGELOG.md sdks/dart/CHANGELOG.md; do
    if ! grep -q "^## $NEW_VERSION\$" "$f"; then
      echo "$f has no '## $NEW_VERSION' entry."
      missing=1
    fi
  done
  return $missing
}

verify_files() {
  local bad=0
  for f in "${VERSIONED_FILES[@]}"; do
    if ! grep -qF "$NEW_VERSION" "$f"; then
      echo "❌ $f does not contain $NEW_VERSION"
      bad=1
    fi
  done
  return $bad
}

rewrite_files() {
  echo "== Bumping to v$NEW_VERSION =="
  export NEW_VERSION
  node - <<'EOF'
const fs = require("fs");
const v = process.env.NEW_VERSION;
const edit = (file, fn) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  fn(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`  ✅ ${file}`);
};
edit("package.json", (p) => { p.version = v; });
edit("package-lock.json", (p) => { p.version = v; if (p.packages && p.packages[""]) p.packages[""].version = v; });
edit("sdks/typescript/package.json", (p) => { p.version = v; });
EOF
  replace() { # file, sed expression
    sed -i -E "$2" "$1"
    echo "  ✅ $1"
  }
  # Version lines, and the constants each SDK sends in its User-Agent
  # (cheki-sdk-typescript/, cheki-python-sdk/, cheki-go-sdk/, cheki-php-sdk/, cheki-dart-sdk/).
  replace python/pyproject.toml          's/^version = ".*"/version = "'"$NEW_VERSION"'"/'
  replace python/cheki/_version.py       's/^__version__ = ".*"/__version__ = "'"$NEW_VERSION"'"/'
  replace sdks/typescript/src/index.ts   's/^const VERSION = ".*";/const VERSION = "'"$NEW_VERSION"'";/'
  replace sdks/typescript/index.js       's/^const VERSION = ".*";/const VERSION = "'"$NEW_VERSION"'";/'
  replace sdks/php/src/VerifyOptions.php "s/public const VERSION = '.*';/public const VERSION = '$NEW_VERSION';/"
  replace sdks/dart/pubspec.yaml         's/^version: .*/version: '"$NEW_VERSION"'/'
  replace sdks/dart/lib/src/cheki_client.dart "s/^const String chekiSdkVersion = '.*';/const String chekiSdkVersion = '$NEW_VERSION';/"
  replace sdks/go/cheki.go               's/^const Version = ".*"/const Version = "'"$NEW_VERSION"'"/'
  replace sdks/go/README.md              's#(github.com/1RB/cheki/sdks/go@v)[0-9]+\.[0-9]+\.[0-9]+#\1'"$NEW_VERSION"'#g'

  # Catches a pattern that no longer matches after a refactor.
  if ! verify_files; then
    echo "Fix the pattern in $0 and retry (git checkout -- . to undo)."
    exit 1
  fi
}

confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  read -r -p "$1 [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Aborted."; exit 1; }
}

check_tags_free() {
  for TAG in "v$NEW_VERSION" "sdks/go/v$NEW_VERSION"; do
    if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
      echo "Tag $TAG already exists. Pick a new version (never move a pushed tag)."
      exit 1
    fi
  done
}

check_clean_main() {
  if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
    echo "Run this on main."
    exit 1
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree is not clean."
    exit 1
  fi
  git fetch -q origin main
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "main is not origin/main. git pull first."
    exit 1
  fi
}

tag_and_push() { # extra refs to push (e.g. main)
  echo "== Tagging $(git rev-parse --short HEAD) =="
  git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"
  git tag -a "sdks/go/v$NEW_VERSION" -m "Go SDK v$NEW_VERSION"
  echo "== Pushing =="
  git push --atomic origin "$@" "refs/tags/v$NEW_VERSION" "refs/tags/sdks/go/v$NEW_VERSION"
  echo ""
  echo "✅ v$NEW_VERSION pushed. publish.yml now publishes to npm, GitHub Packages, PyPI, Packagist and pub.dev, warms proxy.golang.org for sdks/go/v$NEW_VERSION, and checks every registry."
}

case "$MODE" in
  files)
    rewrite_files
    if ! check_changelogs; then
      echo "Add the '## $NEW_VERSION' entries before you open the release PR (CI checks them)."
    fi
    ;;
  tag)
    check_clean_main
    check_tags_free
    if ! verify_files; then
      echo "main does not carry $NEW_VERSION everywhere. Merge the release PR (--files-only) first."
      exit 1
    fi
    check_changelogs || exit 1
    confirm "Tag $(git rev-parse --short HEAD) as v$NEW_VERSION + sdks/go/v$NEW_VERSION and push the tags?"
    tag_and_push
    ;;
  full)
    check_clean_main
    check_tags_free
    check_changelogs || { echo "Add them on main first."; exit 1; }
    confirm "Bump to v$NEW_VERSION, commit, tag v$NEW_VERSION + sdks/go/v$NEW_VERSION and push?"
    rewrite_files
    echo ""
    echo "== Committing =="
    git add -A
    git commit -m "chore: release v$NEW_VERSION"
    tag_and_push main
    ;;
esac
