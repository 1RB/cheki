#!/usr/bin/env bash
# Rebuild the Open Graph image fonts in src/lib/og/fonts (~100 KB total).
#
# ImageResponse (Satori) cannot read woff2 or variable fonts, so the OG cards
# get static TTF instances of the site's own faces, subset to Latin:
#   - Inter from assets/fonts/InterVariable.woff2 (the same file the page font
#     is cut from, scripts/subset-font.sh). Two optical sizes, because the
#     browser picks opsz from font-size on the site: "Inter" at opsz 20 for
#     card-sized text, "Inter Display" at opsz 32 for the headline and amount.
#   - Noto Serif Italic for the italic second line of the hero. The site sets
#     it in the system serif stack (Iowan Old Style, Palatino, Georgia, Noto
#     Serif); Noto Serif is the open-licensed member of that stack, so the card
#     can embed it. assets/fonts/og/NotoSerif-Italic.ttf, Google Fonts (OFL).
#   - JetBrains Mono Medium for the reference ID (the site's --mono stack).
#     assets/fonts/og/JetBrainsMono-Medium.ttf, Google Fonts (OFL).
# The cards render English only; Ethiopic is not included.
#
# Requires fonttools and brotli:  pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="src/lib/og/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

UNICODES="U+0020-007E,U+00A0-00FF,U+2010-2014,U+2018-201D,U+2022,U+2026,U+2192,U+2212"

subset() { # in out
  pyftsubset "$1" --unicodes="$UNICODES" --layout-features="kern" \
    --no-hinting --desubroutinize --output-file="$2"
}

for spec in "Inter-Regular:400:20" "Inter-Medium:500:20" "Inter-SemiBold:600:20" \
            "InterDisplay-SemiBold:600:32" "InterDisplay-Bold:700:32"; do
  IFS=: read -r name wght opsz <<<"$spec"
  fonttools varLib.instancer assets/fonts/InterVariable.woff2 "wght=$wght" "opsz=$opsz" -q -o "$TMP/$name.ttf"
  subset "$TMP/$name.ttf" "$OUT/$name.ttf"
done
subset assets/fonts/og/NotoSerif-Italic.ttf "$OUT/NotoSerif-Italic.ttf"
subset assets/fonts/og/JetBrainsMono-Medium.ttf "$OUT/JetBrainsMono-Medium.ttf"

ls -l "$OUT"
