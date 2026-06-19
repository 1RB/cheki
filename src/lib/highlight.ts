/**
 * Syntax highlighting for guide code blocks using Shiki.
 *
 * Uses the GitHub Dark VS Code theme and supports: bash, json, javascript,
 * typescript, tsx, jsx, python, http, and plaintext.
 *
 * The highlighter instance is cached (createHighlighter loads WASM + grammars
 * and is expensive). Highlighting runs at build time in server components,
 * producing static HTML with inline color styles — no client-side JS needed.
 */

import {
  createHighlighter,
  createJavaScriptRegexEngine,
  type Highlighter,
} from "shiki";

const THEME = "github-dark";

/** Languages we bundle — keep this list small to control bundle size. */
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

// Cache the highlighter — createHighlighter loads grammars and is expensive.
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
 * Highlight code and return an HTML string of <span> elements with inline
 * color styles (from Shiki's GitHub Dark theme).
 *
 * Safe to inject via dangerouslySetInnerHTML — Shiki escapes all source
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
    return extractInnerCode(html);
  } catch {
    // If the requested language fails, fall back to plaintext
    try {
      const html = highlighter.codeToHtml(code, {
        lang: "plaintext",
        theme: THEME,
      });
      return extractInnerCode(html);
    } catch {
      // Ultimate fallback — escaped raw text
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
