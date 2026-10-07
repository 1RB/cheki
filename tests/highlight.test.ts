/**
 * The code block is forced dark in both themes, so it inherits GitHub Dark's
 * token colours verbatim. Comment grey `#6A737D` measures 3.04:1 on that
 * surface — axe flagged it in the light theme too, because the surface never
 * changes. Every emitted foreground must clear 4.5:1.
 */
import { describe, expect, it } from "vitest";
import { fitColorsToCodeBlock, highlightCode } from "@/lib/highlight";

const CODE_BG = "#24292e";

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function contrast(fg: string): number {
  const [r, g, b] = toRgb(fg);
  const l1 = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const [br, bg, bb] = toRgb(CODE_BG);
  const l2 = 0.2126 * lin(br) + 0.7152 * lin(bg) + 0.0722 * lin(bb);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const SAMPLES: [string, string][] = [
  ["typescript", "// is this valid?\nconst x: number = 1;\nconst y = x /* block */ + 1;"],
  ["bash", "# API at http://localhost:3000/api/verify\necho hello"],
  ["python", "# Self-hosting on an Ethiopian IP bypasses geo-blocks\ndef f(): pass"],
  ["json", '{ "a": true }'],
  ["http", "GET /api/verify HTTP/1.1"],
];

describe("code block colour contrast", () => {
  it.each(SAMPLES)("every %s token clears 4.5:1 on the code surface", async (lang, code) => {
    const html = await highlightCode(code, lang);
    const colors = [...html.matchAll(/color:(#[0-9a-f]{6})/gi)].map((m) => m[1]);
    expect(colors.length, `${lang} produced no colour spans`).toBeGreaterThan(0);
    for (const c of colors) {
      expect(
        Number(contrast(c).toFixed(2)),
        `${lang}: ${c} is ${contrast(c).toFixed(2)}:1 on ${CODE_BG}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("lifts the GitHub Dark comment grey", () => {
    const out = fitColorsToCodeBlock('"color:#6A737D"');
    expect(out).not.toContain("#6A737D");
    const hex = /color:(#[0-9a-f]{6})/i.exec(out)![1];
    expect(contrast(hex)).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves colours that already pass untouched", () => {
    expect(fitColorsToCodeBlock('"color:#E1E4E8"')).toBe('"color:#E1E4E8"');
    expect(fitColorsToCodeBlock('"color:#FF5555;background:#000000"')).toBe(
      '"color:#FF5555;background:#000000"',
    );
  });
});
