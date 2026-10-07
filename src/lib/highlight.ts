/**
 * Syntax highlighting for guide code blocks using Shiki.
 *
 * Uses the GitHub Dark VS Code theme and supports: bash, json, javascript,
 * typescript, tsx, jsx, python, http, and plaintext.
 *
 * The highlighter instance is cached (createHighlighter loads WASM + grammars
 * and is expensive). Highlighting runs at build time in server components,
 * producing static HTML with inline color styles, so no client-side JS is needed.
 */

import {
  createHighlighter,
  createJavaScriptRegexEngine,
  type Highlighter,
} from "shiki";

const THEME = "github-dark";

/** Languages we bundle. Keep this list small to control bundle size. */
const LANGS = [
  "bash",
  "json",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "python",
  "http",
  "plaintext",
] as const;

/** Map user-facing language strings to Shiki grammar names. */
const SHIKI_LANG_MAP: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  json: "json",
  typescript: "typescript",
  ts: "typescript",
  tsx: "tsx",
  javascript: "javascript",
  js: "javascript",
  jsx: "jsx",
  python: "python",
  py: "python",
  http: "http",
};

// Cache the highlighter: createHighlighter loads grammars and is expensive.
// We use the JavaScript regex engine (not the default oniguruma WASM engine)
// to avoid WASM-related crashes in some build/CI environments.
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [...LANGS],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

/**
 * Extract the inner HTML from Shiki's <pre><code>...</code></pre> output
 * so it can be injected into our existing <code> element via
 * dangerouslySetInnerHTML. Shiki escapes all source content, so the
 * extracted spans are safe to inject.
 */
function extractInnerCode(html: string): string {
  const codeStart = html.indexOf("<code");
  if (codeStart === -1) return html;
  const contentStart = html.indexOf(">", codeStart) + 1;
  const contentEnd = html.lastIndexOf("</code>");
  if (contentEnd === -1 || contentEnd <= contentStart) return html;
  return html.slice(contentStart, contentEnd);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Colour correction for the code block.
 *
 * The code block keeps a fixed dark surface in both themes (comments must not
 * invert on a light page), but GitHub Dark ships comment grey `#6A737D` which
 * is only 3.04:1 on that surface. Every emitted foreground is therefore lifted
 * toward white until it clears 4.5:1. Colours that already pass are returned
 * untouched, so token hues are preserved.
 */
const CODE_BG = "#24292e";
const MIN_CODE_CONTRAST = 4.5;

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  const p = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase();
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function lum(rgb: [number, number, number]): number {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function contrastToCodeBg(hex: string): number {
  const l1 = lum(toRgb(hex));
  const l2 = lum(toRgb(CODE_BG));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Smallest mix with white that clears the threshold (1 = fully white). */
function liftToCodeContrast(hex: string): string {
  if (contrastToCodeBg(hex) >= MIN_CODE_CONTRAST) return hex;
  const rgb = toRgb(hex);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const mixed = toHex([
      rgb[0] * (1 - mid) + 255 * mid,
      rgb[1] * (1 - mid) + 255 * mid,
      rgb[2] * (1 - mid) + 255 * mid,
    ]);
    if (contrastToCodeBg(mixed) >= MIN_CODE_CONTRAST) hi = mid;
    else lo = mid;
  }
  return toHex([
    rgb[0] * (1 - hi) + 255 * hi,
    rgb[1] * (1 - hi) + 255 * hi,
    rgb[2] * (1 - hi) + 255 * hi,
  ]);
}

/** Rewrites inline `color:#RRGGBB` declarations that fall under 4.5:1. */
export function fitColorsToCodeBlock(html: string): string {
  return html.replace(
    /(["'])color:\s*#([0-9a-f]{6})\b/gi,
    (_m, quote: string, hex: string) => `${quote}color:${liftToCodeContrast(`#${hex}`)}`,
  );
}

/**
 * Highlight code and return an HTML string of <span> elements with inline
 * color styles (from Shiki's GitHub Dark theme).
 *
 * Safe to inject via dangerouslySetInnerHTML, because Shiki escapes all source
 * content. Unknown languages fall back to plaintext.
 */
export async function highlightCode(
  code: string,
  lang?: string,
): Promise<string> {
  const language = (lang || "").toLowerCase().trim();
  const shikiLang = SHIKI_LANG_MAP[language] ?? "plaintext";

  const highlighter = await getHighlighter();

  try {
    const html = highlighter.codeToHtml(code, {
      lang: shikiLang,
      theme: THEME,
    });
    return fitColorsToCodeBlock(extractInnerCode(html));
  } catch {
    // If the requested language fails, fall back to plaintext
    try {
      const html = highlighter.codeToHtml(code, {
        lang: "plaintext",
        theme: THEME,
      });
      return fitColorsToCodeBlock(extractInnerCode(html));
    } catch {
      // Ultimate fallback: escaped raw text
      return escapeHtml(code);
    }
  }
}

const LANG_LABELS: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  json: "json",
  typescript: "typescript",
  ts: "typescript",
  tsx: "tsx",
  javascript: "javascript",
  js: "javascript",
  jsx: "jsx",
  python: "python",
  py: "python",
  http: "http",
};

export function getLangLabel(lang?: string): string | null {
  const l = (lang || "").toLowerCase().trim();
  return LANG_LABELS[l] || null;
}
