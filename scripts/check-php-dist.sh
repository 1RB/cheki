#!/bin/bash
# The Packagist dist (git archive of HEAD, honouring .gitattributes
# export-ignore) must hold only the PHP SDK, and its composer autoload must
# load the SDK. Run from anywhere in the repo; needs php and composer.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ALLOWED='^(composer\.json|LICENSE|sdks/|sdks/php/|sdks/php/README\.md|sdks/php/src/.*)$'
LISTING="$(git archive --format=tar HEAD | tar -t)"
UNEXPECTED="$(printf '%s\n' "$LISTING" | grep -Ev "$ALLOWED" || true)"
if [ -n "$UNEXPECTED" ]; then
  echo "❌ The Packagist dist would ship files outside the PHP SDK. Add them to .gitattributes (export-ignore):"
  printf '%s\n' "$UNEXPECTED"
  exit 1
fi
printf '%s\n' "$LISTING" | grep -q '^sdks/php/src/ChekiClient\.php$' || { echo "❌ sdks/php/src missing from the dist"; exit 1; }

DIST="$(mktemp -d)"
trap 'rm -rf "$DIST"' EXIT
git archive --format=tar HEAD | tar -x -C "$DIST"
composer dump-autoload --working-dir "$DIST" --no-interaction --quiet
php -r '
require $argv[1] . "/vendor/autoload.php";
$c = new Cheki\ChekiClient();
$url = $c->getReceiptUrl("cbe", "fHCxExampleRcpt01");
if (!str_starts_with($url, "https://cheki.et/api/receipt?")) { fwrite(STDERR, "unexpected URL $url\n"); exit(1); }
echo "✅ Packagist dist: " . count(glob($argv[1] . "/sdks/php/src/*.php")) . " SDK files, autoload OK (cheki/cheki " . Cheki\VerifyOptions::VERSION . ")\n";
' "$DIST"
