/**
 * Mobile invariants (source-level, no browser).
 *
 *  1. iOS Safari zooms the page when a focused control's font-size is under
 *     16px. A single coarse-pointer rule lifts every text control to 16px,
 *     and no inline style may set a smaller size on one.
 *  2. A bare `1fr` grid track has an automatic minimum (min-content), so one
 *     nowrap child can push the whole column past its card. On 360px phones
 *     this pushed the receipt field and the Check button 26px out of the
 *     verify card. Tracks must be `minmax(0, 1fr)`.
 *  3. Footer links are 44px rows on touch screens, and fixed full-screen
 *     surfaces clear the home indicator (safe-area inset).
 *  4. Pinch zoom stays available.
 *  5. Inline code wraps at normal break points (break-all split
 *     `"reference":` and 10-character receipt IDs mid-token).
 *  6. In-page anchors clear the sticky nav (#faq landed under it).
 *  7. Nothing paints literal white on var(--ink), which is near-white in
 *     dark mode (the POST badge on /developers was 1.2:1).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

const cssFiles = walk(resolve(root, "src"), /\.css$/);
const tsxFiles = walk(resolve(root, "src"), /\.tsx$/);
const globals = read("src/app/globals.css");

/** Bodies of every `@media (pointer: coarse)` block (brace-matched). */
function coarseBlocks(css: string): string[] {
  const out: string[] = [];
  const re = /@media \(pointer: coarse\)[^{]*\{/g;
  while (re.exec(css) !== null) {
    let depth = 1, i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out;
}

describe("mobile: form controls never trigger iOS focus zoom", () => {
  it("a coarse-pointer rule sets input, select and textarea to 16px", () => {
    const rule = coarseBlocks(globals).find((b) => /\bselect\b/.test(b) && /\btextarea\b/.test(b) && /\binput\b/.test(b));
    expect(rule, "missing @media (pointer: coarse) { input, select, textarea { font-size: 16px } }").toBeDefined();
    expect(rule).toMatch(/font-size:\s*16px\s*!important/);
  });

  it("the bank picker is a transparent 16px select over a 13px face", () => {
    const verify = read("src/components/verify/verify.css");
    expect(verify).toMatch(/\.vi-select \{[^}]*font-size: 16px/);
    expect(verify).toMatch(/\.vi-select \{[^}]*opacity: 0/);
    expect(read("src/components/verify/VerifyInput.tsx")).toContain('className="vi-select-face" aria-hidden="true"');
  });

  it("no inline style gives a form control a font-size under 16px", () => {
    const offenders: string[] = [];
    for (const f of tsxFiles) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/<(input|select|textarea)\b[^>]*?style=\{\{([^}]*)\}\}/g)) {
        const size = /fontSize:\s*"?(\d+(?:\.\d+)?)(px)?"?/.exec(m[2]);
        if (size && Number(size[1]) < 16) offenders.push(`${f.replace(root, "")}: <${m[1]}> fontSize ${size[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("mobile: grid tracks can shrink below their content", () => {
  it("no grid-template-columns uses a bare 1fr track", () => {
    const offenders: string[] = [];
    for (const f of cssFiles) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/grid-template-columns:\s*([^;}]*)/g)) {
        const bare = m[1].replace(/minmax\([^)]*\)/g, "");
        if (/(^|[^\d.])1fr\b/.test(bare)) offenders.push(`${f.replace(root, "")}: ${m[1].trim()}`);
      }
    }
    for (const f of tsxFiles) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/gridTemplateColumns:\s*"([^"]*)"/g)) {
        const bare = m[1].replace(/minmax\([^)]*\)/g, "");
        if (/(^|[^\d.])1fr\b/.test(bare)) offenders.push(`${f.replace(root, "")}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the verify fold, the one that overflowed, stays minmax(0, 1fr)", () => {
    const verify = read("src/components/verify/verify.css");
    expect(verify).toMatch(/\.vp-fold \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  });
});

describe("mobile: touch targets and safe areas", () => {
  it("footer links are 44px rows on touch screens", () => {
    const block = coarseBlocks(globals).find((b) => b.includes(".footer-link"));
    expect(block).toMatch(/\.footer-link[^{]*\{[^}]*min-height:\s*44px/);
  });

  it("the full-screen menu clears the home indicator", () => {
    expect(globals).toMatch(/\.nmm-body \{[^}]*env\(safe-area-inset-bottom/);
  });

  it("small buttons in the verdict and fallback are 44px", () => {
    const verify = read("src/components/verify/verify.css");
    expect(verify).toMatch(/^\.vc-btn--small \{[^}]*min-height: 44px/m);
  });

  it("pinch zoom is never disabled", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).not.toMatch(/userScalable:\s*false/);
    expect(layout).not.toMatch(/maximumScale:\s*1\b/);
  });
});

describe("mobile: wrapping, anchors and dark contrast", () => {
  it("inline code never uses word-break: break-all", () => {
    for (const f of cssFiles) expect(readFileSync(f, "utf8"), f).not.toMatch(/word-break:\s*break-all/);
    for (const f of tsxFiles) expect(readFileSync(f, "utf8"), f).not.toMatch(/wordBreak:\s*"break-all"/);
  });

  it("anchors scroll to below the sticky nav", () => {
    expect(globals).toMatch(/html \{ scroll-padding-top: calc\(var\(--nav-h\) \+ \d+px\); \}/);
  });

  it("no literal white text on an ink background", () => {
    const offenders: string[] = [];
    for (const f of tsxFiles) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/style=\{\{([^}]*)\}\}/g)) {
        if (/background:[^,]*var\(--ink\)/.test(m[1]) && /color:[^,]*"#fff(?:fff)?"/.test(m[1])) offenders.push(f.replace(root, ""));
      }
    }
    expect(offenders).toEqual([]);
  });
});
