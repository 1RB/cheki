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
 *  8. Theme: one shared Light/Dark/System control (header and menu), set
 *     before first paint by a plain inline script (next/script's
 *     beforeInteractive waited for the runtime and flashed the wrong
 *     palette), 44px in the menu with the whole row tappable, en + am
 *     strings, and no motion under prefers-reduced-motion.
 *  9. Language: the same segmented control (English / አማርኛ), header and
 *     menu, no dropdown, selection drawn from html[data-locale] set before
 *     first paint.
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

  it("the bank chooser has a 44px hit area and a 16px filter in the sheet", () => {
    const css = read("src/components/ui/bank-select.css");
    // 32px face, ::before extends it 6px above and below.
    expect(css).toMatch(/\.bs-trigger \{[^}]*height: 32px/);
    expect(css).toMatch(/\.bs-trigger::before \{[^}]*top: -6px; bottom: -6px/);
    expect(css).toMatch(/\.bs-sheet \.bs-filter \{[^}]*font-size: 16px/);
    expect(css).toMatch(/\.bs-opt \{[^}]*min-height: 44px/);
    expect(read("src/components/verify/VerifyInput.tsx")).not.toContain("<select");
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

describe("mobile: theme control", () => {
  const chrome = read("src/components/Chrome.tsx");
  const layout = read("src/app/layout.tsx");

  it("is one shared component, used by the header and the menu, with nothing else toggling the theme", () => {
    expect(chrome.match(/<ThemeControl\b/g)).toHaveLength(2);
    expect(chrome).toContain('<ThemeControl variant="compact" />');
    expect(chrome).toContain('<ThemeControl labelledBy="nmm-theme-label" />');
    const writers = tsxFiles.filter((f) => /setAttribute\(\s*"data-theme"|localStorage\.setItem\(\s*["']cheki-theme/.test(readFileSync(f, "utf8")));
    expect(writers.map((f) => f.replace(root, ""))).toEqual([]);
  });

  it("the theme is set by a plain inline script in <head>, not next/script", () => {
    expect(layout).not.toMatch(/from "next\/script"/);
    expect(layout).toMatch(/<script id="cheki-theme-init" dangerouslySetInnerHTML=\{\{ __html: THEME_INIT_SCRIPT \}\} \/>/);
    expect(layout).toMatch(/<html [^>]*suppressHydrationWarning/);
  });

  it("the control is a radiogroup of aria-checked radios", () => {
    const src = read("src/components/segmented-control.tsx");
    expect(src).toContain('role="radiogroup"');
    expect(src).toContain('role="radio"');
    expect(src).toMatch(/aria-checked=\{checked\}/);
    // no placeholder-until-mounted: the selection is CSS-driven from data-theme-pref
    expect(src + read("src/components/theme-control.tsx")).not.toMatch(/setMounted|mounted\)/);
    for (const p of ["light", "dark", "system"]) {
      expect(globals).toContain(`html[data-theme-pref="${p}"] .tc-opt[data-v="${p}"]::before`);
    }
  });

  it("menu options are 44px (38px + 3px track padding) and fill the 52px row", () => {
    expect(globals).toMatch(/^\.tc \{[^}]*padding: 3px/m);
    expect(globals).toMatch(/^\.tc-opt \{[^}]*min-height: 0; height: 38px/m);
    // options are sized to their labels: no equal-width grid that overflows a 360px row
    expect(globals).toMatch(/^\.tc \{[^}]*display: inline-flex/m);
    expect(globals).toMatch(/\.nmm-row--setting \.tc-opt::after \{[^}]*top: -7px; bottom: -7px/);
    expect(globals).toMatch(/@media \(pointer: coarse\) \{ \.tc--compact \.tc-opt \{[^}]*height: 38px/);
  });

  it("the desktop header only shows where it fits (1024px+); below that, the menu", () => {
    expect(globals).toMatch(/@media \(max-width: 1023px\) \{\s*\.nav-desktop \{ display: none !important; \}/);
    expect(globals).toContain("@media (min-width: 1024px) { .nav-mobile-actions { display: none; } }");
  });

  it("has no motion under prefers-reduced-motion", () => {
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.tc-opt, \.tc-opt::before \{ transition: none; \}/);
  });

  it("has English and Amharic strings", async () => {
    const { translations } = await import("@/lib/i18n/translations");
    for (const locale of ["en", "am"] as const) {
      const theme = (translations[locale] as unknown as { theme?: Record<string, string> }).theme;
      expect(theme, locale).toBeDefined();
      for (const k of ["label", "light", "dark", "system"]) expect(theme?.[k], `${locale}.theme.${k}`).toBeTruthy();
    }
    expect(chrome).toContain('t("theme.label")');
  });
});

describe("mobile: language control", () => {
  const chrome = read("src/components/Chrome.tsx");
  const layout = read("src/app/layout.tsx");
  const switcher = read("src/components/language-switcher.tsx");

  it("is the shared segmented control in both places, not a dropdown", () => {
    expect(chrome).toContain('<LanguageSwitcher variant="compact" />');
    expect(chrome).toContain('<LanguageSwitcher variant="full" labelledBy="nmm-lang-label" />');
    expect(switcher).toContain("<SegmentedControl");
    expect(switcher).not.toMatch(/aria-expanded|useState|mousedown/);
    // the old dropdown marked the current locale in brand green; green means bank-confirmed only
    expect(switcher).not.toMatch(/--green/);
    expect(read("src/components/theme-control.tsx")).toContain("<SegmentedControl");
  });

  it("both settings rows are whole-row tappable 44px rows sharing one class", () => {
    expect(chrome.match(/className="nmm-row nmm-row--setting" onClick=\{onSettingRowClick\}/g)).toHaveLength(2);
    expect(globals).toMatch(/\.nmm-row--setting \.tc-opt::after \{[^}]*top: -7px; bottom: -7px/);
  });

  it("the selection is drawn from html[data-locale] (every locale), set inline before first paint", async () => {
    expect(layout).toMatch(/<script id="cheki-locale-init" dangerouslySetInnerHTML=\{\{ __html: LOCALE_INIT_SCRIPT \}\} \/>/);
    const { translations } = await import("@/lib/i18n/translations");
    for (const l of Object.keys(translations)) expect(globals).toContain(`html[data-locale="${l}"] .tc-opt[data-v="${l}"]::before`);
  });

  it("options carry their language so Amharic is pronounced as Amharic", () => {
    expect(read("src/components/segmented-control.tsx")).toMatch(/lang=\{o\.lang\}/);
    expect(switcher).toMatch(/lang: code/);
  });
});
