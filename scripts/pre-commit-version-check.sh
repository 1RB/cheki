#!/bin/bash
# Pre-commit hook: check version sync across all packages
# Install: cp scripts/pre-commit-version-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

WEB=$(node -p "require('./package.json').version" 2>/dev/null || echo "N/A")
TS=$(node -p "require('./sdks/typescript/package.json').version" 2>/dev/null || echo "N/A")

if [ "$WEB" != "$TS" ]; then
  echo "❌ Version mismatch: web ($WEB) vs TypeScript SDK ($TS)"
  echo "Run: ./scripts/sync-package-metadata.sh"
  exit 1
fi

# Check if bank count in description matches manifest
LIVE=$(node -p "require('./src/lib/manifest/banks.json').filter(b => b.status === 'live' && b.id !== 'cbe-new').length" 2>/dev/null || echo "N/A")
if [ "$LIVE" != "10" ]; then
  echo "⚠️ Live bank count changed: $LIVE. Update package descriptions."
fi

echo "✅ Version sync OK ($WEB)"
