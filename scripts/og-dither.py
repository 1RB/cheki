#!/usr/bin/env python3
"""
Dither a piece of hero art into a crisp 1200x630 palette PNG for an OG card
(OG_VARIANT pixels | bitmap | ember, see src/lib/og/concepts/painted.tsx).

    python3 scripts/og-dither.py IN.png OUT.png --dot 5 --ink 15120f --paper f4f0e7 \
        [--accent 16a34a] [--crop x,y,w,h] [--gamma 1.0] [--contrast 1.0] [--mode fs|bayer]

The art is reduced to a grid of `dot`-pixel cells (240x126 at dot 5), dithered
there and scaled back up with nearest-neighbour, so every dot is a hard square
`dot` px wide. Coarse dots matter: at the ~300px a chat preview shows, a
5px dot is still ~1.25px, the dither reads as texture instead of grey mush,
and error diffusion (Floyd-Steinberg, the default) has no regular period to
beat against the downscale, so there is no moire.

With --accent, cells whose source pixels are saturated green (the success
tick on a phone) are dithered in the accent colour instead of the paper, so
the one green thing stays green and everything else is two-tone.

Needs Pillow and numpy.
"""
import argparse

import numpy as np
from PIL import Image, ImageOps

BAYER8 = np.array(
    [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ]
) / 64.0


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def floyd(g: np.ndarray) -> np.ndarray:
    """Serpentine Floyd-Steinberg on a float image in 0..1; returns a bool 'paper' mask."""
    g = g.copy()
    h, w = g.shape
    out = np.zeros_like(g, dtype=bool)
    for y in range(h):
        xs = range(w) if y % 2 == 0 else range(w - 1, -1, -1)
        d = 1 if y % 2 == 0 else -1
        for x in xs:
            old = g[y, x]
            new = 1.0 if old >= 0.5 else 0.0
            out[y, x] = new > 0
            err = old - new
            if 0 <= x + d < w:
                g[y, x + d] += err * 7 / 16
            if y + 1 < h:
                if 0 <= x - d < w:
                    g[y + 1, x - d] += err * 3 / 16
                g[y + 1, x] += err * 5 / 16
                if 0 <= x + d < w:
                    g[y + 1, x + d] += err * 1 / 16
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--dot", type=int, default=5)
    ap.add_argument("--ink", default="15120f")
    ap.add_argument("--paper", default="f4f0e7")
    ap.add_argument("--accent")
    ap.add_argument("--crop", help="x,y,w,h of the source to fit into 1200x630")
    ap.add_argument("--gamma", type=float, default=1.0)
    ap.add_argument("--contrast", type=float, default=1.0)
    ap.add_argument("--mode", choices=["fs", "bayer"], default="fs")
    ap.add_argument("--accent-box", help="x0,y0,x1,y1 on the 1200x630 card: only green inside it becomes accent")
    ap.add_argument("--levels", default="0,1", help="black,white points in 0..1: tones outside dither to solid ink/paper")
    a = ap.parse_args()

    im = Image.open(a.src).convert("RGB")
    if a.crop:
        x, y, w, h = map(int, a.crop.split(","))
        im = im.crop((x, y, x + w, y + h))
    im = ImageOps.fit(im, (1200, 630), Image.LANCZOS)
    gw, gh = 1200 // a.dot, 630 // a.dot
    small = np.asarray(im.resize((gw, gh), Image.LANCZOS), dtype=float) / 255
    lum = small @ np.array([0.299, 0.587, 0.114])
    lo, hi = map(float, a.levels.split(","))
    lum = np.clip((lum - lo) / (hi - lo), 0, 1)
    lum = np.clip((lum - 0.5) * a.contrast + 0.5, 0, 1) ** a.gamma
    on = lum > BAYER8[np.arange(gh)[:, None] % 8, np.arange(gw)[None, :] % 8] if a.mode == "bayer" else floyd(lum)

    ink, paper = np.array(hex_rgb(a.ink)), np.array(hex_rgb(a.paper))
    rgb = np.where(on[..., None], paper, ink)
    if a.accent:
        r, g, b = small[..., 0], small[..., 1], small[..., 2]
        green = (g > r + 0.12) & (g > b + 0.08) & (g > 0.3)
        if a.accent_box:
            x0, y0, x1, y1 = (int(v) // a.dot for v in a.accent_box.split(","))
            box = np.zeros_like(green)
            box[y0:y1, x0:x1] = True
            green &= box
        # green cells are solid accent: the tick is the one flat, undithered colour
        rgb = np.where(green[..., None], np.array(hex_rgb(a.accent)), rgb)
    out = Image.fromarray(rgb.astype("uint8")).resize((gw * a.dot, gh * a.dot), Image.NEAREST)
    canvas = Image.new("RGB", (1200, 630), tuple(int(c) for c in ink))
    canvas.paste(out, (0, 0))
    canvas.quantize(colors=3 if a.accent else 2, method=Image.Quantize.MEDIANCUT).save(a.out, optimize=True)


if __name__ == "__main__":
    main()
