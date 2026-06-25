#!/bin/bash
# Sync package metadata across all SDKs whenever repo changes
# Run: ./scripts/sync-package-metadata.sh
# Or: source this in a pre-commit hook

set -e

echo "== Syncing package metadata =="

# Verify all versions match
WEB_VERSION=$(node -p "require('./package.json').version")
TS_VERSION=$(node -p "require('./sdks/typescript/package.json').version")
PYTHON_VERSION=$(python3 -c "import tomllib; print(tomllib.load(open('python/pyproject.toml','rb'))['project']['version'])")

PHP_VERSION=$(php -r "echo json_decode(file_get_contents('sdks/php/composer.json'))->version;" 2>/dev/null || echo "N/A")
DART_VERSION=$(grep "^version:" sdks/dart/pubspec.yaml | cut -d: -f2 | tr -d ' ')

echo "Web app:    $WEB_VERSION"
echo "TypeScript: $TS_VERSION"
echo "Python:     $PYTHON_VERSION"
echo "PHP:        $PHP_VERSION"
echo "Dart:       $DART_VERSION"

# Check for mismatches
if [ "$WEB_VERSION" != "$TS_VERSION" ]; then
  echo "⚠️ Version mismatch: web ($WEB_VERSION) vs TypeScript ($TS_VERSION)"
fi

if [ "$WEB_VERSION" != "$PYTHON_VERSION" ]; then
  echo "⚠️ Version mismatch: web ($WEB_VERSION) vs Python ($PYTHON_VERSION)"
fi

echo "== Done =="
