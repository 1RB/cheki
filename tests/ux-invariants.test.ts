/**
 * Structural UX invariants.
 *
 * These cover the failure modes that axe and Lighthouse only catch in one
 * theme, or only when a particular state happens to be on screen:
 *
 *  1. The dark palette is declared twice (system preference and the theme
 *     toggle) and the two copies had drifted, costing 47 contrast violations
 *     on the homepage alone.
 *  2. Filled buttons are the site's only high-chroma surfaces, so their
 *     foreground must come from a theme token, never a literal #fff.
 *  3. Cross-page anchors (`/#verify`, `#faq`) were linking to ids that did
 *     not exist on the target page.
 *  4. Hiding the scrollbar on a wide comparison table removes the only
 *     signal that the table continues.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const css = read("src/app/globals.css");

/* ── token extraction ─────────────────────────────────────────────── */

/** Returns the body of the first rule whose selector text contains `needle`. */
function ruleBody(source: string, needle: string): string {
  const at = source.indexOf(needle);
  expect(at, `selector not found: ${needle}`).toBeGreaterThan(-1);
  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced rule for ${needle}`);
}

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2].trim();
  return out;
}

/** Follows `var(--x)` chains until every value is literal. */
function resolveTokens(tokens: Record<string, string>): Record<string, string> {
  const out = { ...tokens };
  const seen = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, v] of Object.entries(out)) {
      const m = /^var\((--[\w-]+)\)$/.exec(v);
      if (m && out[m[1]] !== undefined && !seen.has(`${k}->${m[1]}`)) {
        out[k] = out[m[1]];
        seen.add(`${k}->${m[1]}`);
        changed = true;
      }
    }
  }
  return out;
}

const light = resolveTokens(declarations(ruleBody(css, ":root {")));
const dark = resolveTokens(declarations(ruleBody(css, '[data-theme="dark"]')));
const SCHEMES: [string, Record<string, string>][] = [
  ["light", light],
  ["dark", dark],
];

/* ── colour maths (WCAG 2.1 relative luminance) ───────────────────── */

type RGBA = [number, number, number, number];

function rgba(input: string): RGBA {
  const v = input.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,]+([\d.]+))?\s*\)$/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  throw new Error(`unsupported colour: ${input}`);
}

function flatten(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: RGBA): number {
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

function ratio(a: RGBA, b: RGBA): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast of one token against another, compositing alpha over --bg. */
function contrast(fg: string, bg: string, tokens: Record<string, string>): number {
  const page = rgba(tokens["--bg"]);
  const bgOpaque = flatten(rgba(tokens[bg]), page);
  const fgOpaque = flatten(rgba(tokens[fg]), bgOpaque);
  return ratio(fgOpaque, bgOpaque);
}

/** [foreground token, background token, minimum ratio] */
const PAIRS: [string, string, number][] = [
  ["--green-cta-fg", "--green-cta", 4.5],
  ["--red-cta-fg", "--red-cta", 4.5],
  ["--red-text", "--red-light", 4.5],
  ["--amber-text", "--amber-light", 4.5],
  ["--ink", "--bg", 4.5],
  ["--ink-2", "--bg", 4.5],
  ["--ink-3", "--bg", 4.5],
  ["--ink-3", "--surface", 4.5],
  ["--ink-3", "--surface-alt", 4.5],
  ["--ink-2", "--surface-alt", 4.5],
  ["--green-dark", "--bg", 4.5],
  ["--green-dark", "--surface", 4.5],
  ["--code-text", "--code-bg", 4.5],
];

describe("theme palette", () => {
  it("declares the dark palette identically for system preference and the toggle", () => {
    const system = declarations(ruleBody(css, ':root:not([data-theme="light"])'));
    const toggle = declarations(ruleBody(css, '[data-theme="dark"]'));

    expect(Object.keys(toggle).sort()).toEqual(Object.keys(system).sort());
    for (const key of Object.keys(toggle)) {
      expect(toggle[key], `${key} differs between the two dark blocks`).toBe(system[key]);
    }
  });

  it.each(SCHEMES)("%s scheme keeps every text pair at AA", (name, tokens) => {
    for (const [fg, bg, min] of PAIRS) {
      expect(tokens[fg], `${name}: missing ${fg}`).toBeDefined();
      expect(tokens[bg], `${name}: missing ${bg}`).toBeDefined();
      const value = contrast(fg, bg, tokens);
      expect(
        Number(value.toFixed(2)),
        `${name}: ${tokens[fg]} on ${tokens[bg]} is ${value.toFixed(2)}:1 (need ${min})`,
      ).toBeGreaterThanOrEqual(min);
    }
  });

  it("never falls back to a literal light foreground on a filled button", () => {
    const button = read("src/components/motion/stateful-button.tsx");
    expect(button).not.toMatch(/:\s*"#fff"/);
    expect(button).toContain("var(--green-cta-fg)");
    expect(button).toContain("var(--red-cta-fg)");
  });
});

describe("cross-page anchors", () => {
  it("gives every linked id a real target", () => {
    expect(read("src/components/HomePage.tsx")).toContain('id="verify"');
    expect(read("src/app/verify/[slug]/page.tsx")).toContain('id="faq"');
    expect(read("src/app/banks/[code]/page.tsx")).toContain("/#verify");
  });
});

describe("wide tables", () => {
  it("keeps a visible scrollbar so the table says it continues", () => {
    const tableRule = ruleBody(css, ".prose .table-wrap, .table-wrap {");
    expect(tableRule).not.toContain("scrollbar-width: none");
    expect(tableRule).toMatch(/scrollbar-width:\s*thin/);
  });
});
