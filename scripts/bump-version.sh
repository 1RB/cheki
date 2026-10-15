#!/bin/bash
# Bump the version in every package and SDK constant, commit, tag and push.
# Usage: ./scripts/bump-version.sh <new_version>      (run from main, clean tree)
# Example: ./scripts/bump-version.sh 1.4.2
#
# Pushes two tags on the release commit, atomically with main:
#   vX.Y.Z           triggers .github/workflows/publish.yml (npm, GitHub Packages,
#                    PyPI, Packagist, pub.dev, Go proxy warm-up)
#   sdks/go/vX.Y.Z   the Go module version (a module in a subdirectory is tagged
#                    with its path prefix); it triggers nothing on its own
# See docs/RELEASING.md.

set -euo pipefail

NEW_VERSION="${1:-}"
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <new_version>"
  echo "Example: $0 1.4.2"
  exit 1
fi
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must be X.Y.Z (got '$NEW_VERSION')."
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
  echo "Run this on main."
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean."
  exit 1
fi
for TAG in "v$NEW_VERSION" "sdks/go/v$NEW_VERSION"; do
  if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
    echo "Tag $TAG already exists. Pick a new version."
    exit 1
  fi
done

if ! grep -q "^## $NEW_VERSION\$" sdks/dart/CHANGELOG.md; then
  echo "sdks/dart/CHANGELOG.md has no '## $NEW_VERSION' entry (pub.dev shows it). Add it on main first."
  exit 1
fi

read -r -p "Bump to v$NEW_VERSION, commit, tag v$NEW_VERSION + sdks/go/v$NEW_VERSION and push? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

echo "== Bumping to v$NEW_VERSION =="
export NEW_VERSION

# JSON manifests. composer.json has no "version" on purpose: Packagist takes
# the version from the git tag.
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

# Version lines and the constants each SDK sends in its User-Agent.
replace() { # file, sed expression
  sed -i -E "$2" "$1"
  echo "  ✅ $1"
}
replace python/pyproject.toml          's/^version = ".*"/version = "'"$NEW_VERSION"'"/'
replace python/cheki/_version.py       's/^__version__ = ".*"/__version__ = "'"$NEW_VERSION"'"/'
replace sdks/typescript/src/index.ts   's/^const VERSION = ".*";/const VERSION = "'"$NEW_VERSION"'";/'
replace sdks/typescript/index.js       's/^const VERSION = ".*";/const VERSION = "'"$NEW_VERSION"'";/'
replace sdks/php/src/VerifyOptions.php "s/public const VERSION = '.*';/public const VERSION = '$NEW_VERSION';/"
replace sdks/dart/pubspec.yaml         's/^version: .*/version: '"$NEW_VERSION"'/'
replace sdks/dart/lib/src/cheki_client.dart "s/^const String chekiSdkVersion = '.*';/const String chekiSdkVersion = '$NEW_VERSION';/"
replace sdks/go/cheki.go               's/^const Version = ".*"/const Version = "'"$NEW_VERSION"'"/'

# Every file above must now carry the new version (catches a pattern that no
# longer matches after a refactor).
for f in package.json package-lock.json sdks/typescript/package.json \
         python/pyproject.toml python/cheki/_version.py sdks/typescript/src/index.ts \
         sdks/typescript/index.js sdks/php/src/VerifyOptions.php sdks/dart/pubspec.yaml \
         sdks/dart/lib/src/cheki_client.dart sdks/go/cheki.go; do
  if ! grep -qF "$NEW_VERSION" "$f"; then
    echo "❌ $f does not contain $NEW_VERSION; fix the pattern and retry (git checkout -- . to undo)."
    exit 1
  fi
done

echo ""
echo "== Committing =="
git add -A
git commit -m "chore: release v$NEW_VERSION"

echo "== Tagging =="
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"
git tag -a "sdks/go/v$NEW_VERSION" -m "Go SDK v$NEW_VERSION"

echo "== Pushing =="
git push --atomic origin main "refs/tags/v$NEW_VERSION" "refs/tags/sdks/go/v$NEW_VERSION"

echo ""
echo "✅ v$NEW_VERSION pushed. publish.yml now publishes to npm, GitHub Packages, PyPI, Packagist and pub.dev, and warms proxy.golang.org for sdks/go/v$NEW_VERSION."
