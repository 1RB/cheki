#!/usr/bin/env bash
# Rebuild src/app/fonts/inter-latin.woff2 (~46 KB) from the full Inter variable font.
#
# The full InterVariable.woff2 is ~352 KB (Latin, Latin Extended, Cyrillic,
# Greek, Vietnamese, two axes). The site only renders Latin text in Inter
# (Amharic falls back to the system Ethiopic font), so the page font is:
#   - the opsz axis pinned to its default (14), which drops a whole axis,
#   - the wght axis limited to 400-800, the weights the CSS uses,
#   - Basic Latin + Latin-1, general punctuation, arrows, the euro sign and a
#     few symbols (check, cross, minus, trademark),
#   - no hinting; OpenType features kern (GPOS pair kerning), calt
#     (contextual alternates), liga, tnum (tabular figures: amounts, times)
#     and case. Keep kern and calt: dropping them is what makes small bold
#     labels look unevenly tracked.
#
# Checked Oct 2026 (PR #35 design pass): the subset's GPOS still carries the
# full kern lookup, and it renders identically to the 352 KB original. The
# uneven spacing seen in headless screenshots came from Linux Chromium's
# default font-render-hinting (FreeType rounds hinted advances to whole
# pixels); with --font-render-hinting=none, which is how macOS, iOS, Android
# and Windows lay text out (fractional advances), spacing is even. The site
# CSS also stopped adding positive letter-spacing to small bold text.
# It is loaded with next/font/local (display: optional) in src/app/layout.tsx.
#
# Requires fonttools and brotli:  pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="assets/fonts/InterVariable.woff2"
OUT="src/app/fonts/inter-latin.woff2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$(dirname "$OUT")"

# 1. Limit wght (variable font instancer). Do not pin opsz (see above).
fonttools varLib.instancer "$SRC" wght=400:800 -o "$TMP/inter-instanced.ttf"

# 2. Subset to the glyphs the site renders.
pyftsubset "$TMP/inter-instanced.ttf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2190-2193,U+20AC,U+2122,U+2212,U+2715,U+2713" \
  --layout-features="kern,liga,calt,tnum,case" \
  --no-hinting \
  --desubroutinize \
  --flavor=woff2 \
  --output-file="$OUT"

ls -l "$SRC" "$OUT"
