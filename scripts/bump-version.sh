#!/bin/bash
# Bump version across all packages, commit, tag, and push
# Usage: ./scripts/bump-version.sh <new_version>
# Example: ./scripts/bump-version.sh 1.4.1

set -e

NEW_VERSION="${1:-}"
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <new_version>"
  echo "Example: $0 1.4.1"
  exit 1
fi

# Confirm
read -p "Bump to v$NEW_VERSION? All packages + tag + push? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

echo "== Bumping to v$NEW_VERSION =="

# Web app
node -e "const p=require('./package.json'); p.version='$NEW_VERSION'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)+'\n');" 2>/dev/null
# Also update package-lock.json if it exists
if [ -f package-lock.json ]; then
  sed -i 's/"version": "'"$OLD_VERSION"'"/"version": "'"$NEW_VERSION"'"/' package-lock.json 2>/dev/null || true
fi
echo "  ✅ package.json (+ package-lock.json if exists)"

# TypeScript SDK
node -e "const p=require('./sdks/typescript/package.json'); p.version='$NEW_VERSION'; require('fs').writeFileSync('sdks/typescript/package.json', JSON.stringify(p, null, 2)+'\n');" 2>/dev/null
echo "  ✅ sdks/typescript/package.json"

# Python SDK
sed -i 's/^version = ".*"/version = "'"$NEW_VERSION"'"/' python/pyproject.toml 2>/dev/null
echo "  ✅ python/pyproject.toml"

# PHP SDK
if command -v php &> /dev/null; then
  php -r "\$f='sdks/php/composer.json'; \$d=json_decode(file_get_contents(\$f)); \$d->version='$NEW_VERSION'; file_put_contents(\$f, json_encode(\$d, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).\"\n\");" 2>/dev/null
  echo "  ✅ sdks/php/composer.json"
else
  echo "  ⚠️ php not installed, skip sdks/php/composer.json"
fi

# Dart SDK
sed -i "s/^version: .*/version: $NEW_VERSION/" sdks/dart/pubspec.yaml 2>/dev/null
echo "  ✅ sdks/dart/pubspec.yaml"

echo ""
echo "== Committing =="
git add -A
git commit -m "chore: release v$NEW_VERSION" || echo "  ✅ already committed"

echo "== Tagging =="
git tag -f "v$NEW_VERSION"

echo "== Pushing =="
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✅ v$NEW_VERSION released. CI/CD will publish to npm, PyPI, GitHub Packages, and Packagist."
