/**
 * Lightweight syntax highlighter for guide code blocks.
 *
 * Supports: bash, json, typescript, javascript, http, python
 * Zero dependencies - uses regex tokenization with CSS classes.
 *
 * The output is HTML string with <span> tags that map to CSS classes
 * defined in globals.css under .code-highlight-*.
 *
 * This is intentionally simple. It handles ~90% of cases well.
 * For complex code, the fallback is plain monospace text which is fine.
 */

type Token = { type: string; value: string };

const BASH_KEYWORDS = /\b(curl|export|cd|git|docker|npm|npx|node|python|pip|go|sudo|apt|brew|kubectl|gh|echo|cat|mkdir|rm|cp|mv|chmod|ssh|wget|tar|unzip|docker-compose|vercel)\b/g;
const TS_KEYWORDS = /\b(const|let|var|function|class|extends|implements|interface|type|enum|return|if|else|for|while|switch|case|break|continue|new|this|super|import|export|from|as|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|yield|readonly|abstract|static|public|private|protected|namespace|declare|module|require)\b/g;
const PY_KEYWORDS = /\b(def|class|import|from|as|return|if|elif|else|for|while|try|except|finally|with|raise|yield|lambda|pass|break|continue|global|nonlocal|assert|del|in|is|not|and|or|None|True|False|self|cls|async|await)\b/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tokenizeBash(code: string): Token[] {
  const tokens: Token[] = [];
  // Comments
  let remaining = code;
  const parts = remaining.split(/(#.*?$)/m);
  // This approach is messy - let's do a simpler line-based approach
  return lineTokenize(code, (line) => {
    const tokens: Token[] = [];
    // Comment
    const commentIdx = line.indexOf("#");
    let codePart = line;
    let comment = "";
    if (commentIdx >= 0 && !line.slice(0, commentIdx).includes('"')) {
      codePart = line.slice(0, commentIdx);
      comment = line.slice(commentIdx);
    }

    // Strings (single and double quoted)
    const stringParts = codePart.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
    for (const part of stringParts) {
      if ((part.startsWith('"') || part.startsWith("'")) && part.length > 1) {
        tokens.push({ type: "string", value: part });
      } else {
        // Keywords
        let subParts = part.split(BASH_KEYWORDS);
        subParts = subParts.flatMap((s) => s.split(/(\$\w+|\$\{[^}]+\}|&&|\|\||;|>>|>)/g));
        for (const sp of subParts) {
          if (!sp) continue;
          if (BASH_KEYWORDS.test(sp)) {
            tokens.push({ type: "keyword", value: sp });
          } else if (/^\$/.test(sp)) {
            tokens.push({ type: "variable", value: sp });
          } else if (/^(&&|\|\||;|>>|>)$/.test(sp)) {
            tokens.push({ type: "operator", value: sp });
          } else {
            tokens.push({ type: "text", value: sp });
          }
          BASH_KEYWORDS.lastIndex = 0;
        }
      }
    }
    if (comment) tokens.push({ type: "comment", value: comment });
    return tokens;
  });
}

function tokenizeJson(code: string): Token[] {
  return lineTokenize(code, (line) => {
    const tokens: Token[] = [];
    const parts = line.split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|[-+]?\d+\.?\d*(?:[eE][-+]?\d+)?|[{}[\],:])/g);
    for (const part of parts) {
      if (!part) continue;
      if (/"\s*:?$/.test(part)) {
        tokens.push({ type: "key", value: part });
      } else if (part.startsWith('"')) {
        tokens.push({ type: "string", value: part });
      } else if (/^(true|false|null)$/.test(part)) {
        tokens.push({ type: "keyword", value: part });
      } else if (/^[-+]?\d/.test(part)) {
        tokens.push({ type: "number", value: part });
      } else if (/^[{}[\],:]$/.test(part)) {
        tokens.push({ type: "punctuation", value: part });
      } else {
        tokens.push({ type: "text", value: part });
      }
    }
    return tokens;
  });
}

function tokenizeTs(code: string): Token[] {
  return lineTokenize(code, (line) => {
    const tokens: Token[] = [];
    // Handle line comments
    const commentIdx = line.indexOf("//");
    let codePart = line;
    let comment = "";
    if (commentIdx >= 0) {
      codePart = line.slice(0, commentIdx);
      comment = line.slice(commentIdx);
    }

    // Strings (template literals, single, double)
    const stringParts = codePart.split(/(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
    for (const part of stringParts) {
      if ((part.startsWith("`") || part.startsWith('"') || part.startsWith("'")) && part.length > 1) {
        tokens.push({ type: "string", value: part });
      } else if (!part) {
        continue;
      } else {
        // Keywords, types, numbers
        let subParts = part.split(TS_KEYWORDS);
        subParts = subParts.flatMap((s) => s.split(/(\b[A-Z]\w*\b|\b\d+\.?\d*\b|=>|&&|\|\||;|[{}()[\]])/g));
        for (const sp of subParts) {
          if (!sp) continue;
          if (TS_KEYWORDS.test(sp)) {
            tokens.push({ type: "keyword", value: sp });
          } else if (/^[A-Z]/.test(sp)) {
            tokens.push({ type: "type", value: sp });
          } else if (/^\d/.test(sp)) {
            tokens.push({ type: "number", value: sp });
          } else if (/^(=>|&&|\|\||;|[{}()[\]])$/.test(sp)) {
            tokens.push({ type: "punctuation", value: sp });
          } else {
            tokens.push({ type: "text", value: sp });
          }
          TS_KEYWORDS.lastIndex = 0;
        }
      }
    }
    if (comment) tokens.push({ type: "comment", value: comment });
    return tokens;
  });
}

function tokenizePython(code: string): Token[] {
  return lineTokenize(code, (line) => {
    const tokens: Token[] = [];
    const commentIdx = line.indexOf("#");
    let codePart = line;
    let comment = "";
    if (commentIdx >= 0) {
      codePart = line.slice(0, commentIdx);
      comment = line.slice(commentIdx);
    }

    const stringParts = codePart.split(/("""[\s\S]*?"""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
    for (const part of stringParts) {
      if ((part.startsWith('"') || part.startsWith("'")) && part.length > 1) {
        tokens.push({ type: "string", value: part });
      } else if (!part) {
        continue;
      } else {
        let subParts = part.split(PY_KEYWORDS);
        subParts = subParts.flatMap((s) => s.split(/(\b\d+\.?\d*\b|=>|and|or|not|in|is|[{}()[\]:.])/g));
        for (const sp of subParts) {
          if (!sp) continue;
          if (PY_KEYWORDS.test(sp)) {
            tokens.push({ type: "keyword", value: sp });
          } else if (/^\d/.test(sp)) {
            tokens.push({ type: "number", value: sp });
          } else if (/^[{}()[\]:.]$/.test(sp)) {
            tokens.push({ type: "punctuation", value: sp });
          } else {
            tokens.push({ type: "text", value: sp });
          }
          PY_KEYWORDS.lastIndex = 0;
        }
      }
    }
    if (comment) tokens.push({ type: "comment", value: comment });
    return tokens;
  });
}

function tokenizeHttp(code: string): Token[] {
  return lineTokenize(code, (line) => {
    const tokens: Token[] = [];
    // HTTP method + URL
    if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(line)) {
      const parts = line.split(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/);
      tokens.push({ type: "keyword", value: parts[1] });
      tokens.push({ type: "text", value: " " });
      tokens.push({ type: "string", value: parts[2] });
      if (parts[3]) tokens.push({ type: "text", value: parts[3] });
      return tokens;
    }
    // Header lines: Key: value
    if (/^[A-Z][\w-]+:\s/.test(line)) {
      const idx = line.indexOf(":");
      tokens.push({ type: "key", value: line.slice(0, idx + 1) });
      tokens.push({ type: "text", value: " " });
      tokens.push({ type: "string", value: line.slice(idx + 2) });
      return tokens;
    }
    // Comment / blank
    if (/^(#|\/\*)/.test(line)) {
      tokens.push({ type: "comment", value: line });
      return tokens;
    }
    tokens.push({ type: "text", value: line });
    return tokens;
  });
}

function lineTokenize(code: string, fn: (line: string) => Token[]): Token[] {
  const lines = code.split("\n");
  const result: Token[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) result.push({ type: "newline", value: "\n" });
    result.push(...fn(lines[i]));
  }
  return result;
}

function tokensToHtml(tokens: Token[]): string {
  return tokens
    .map((t) => {
      if (t.type === "text" || t.type === "newline") return escapeHtml(t.value);
      return `<span class="ch-${t.type}">${escapeHtml(t.value)}</span>`;
    })
    .join("");
}

export function highlightCode(code: string, lang?: string): string {
  const language = (lang || "").toLowerCase().trim();

  try {
    switch (language) {
      case "bash":
      case "sh":
      case "shell":
      case "zsh":
        return tokensToHtml(tokenizeBash(code));
      case "json":
        return tokensToHtml(tokenizeJson(code));
      case "typescript":
      case "ts":
      case "tsx":
      case "javascript":
      case "js":
      case "jsx":
        return tokensToHtml(tokenizeTs(code));
      case "python":
      case "py":
        return tokensToHtml(tokenizePython(code));
      case "http":
        return tokensToHtml(tokenizeHttp(code));
      default:
        return escapeHtml(code);
    }
  } catch {
    // If highlighting fails, return plain escaped code
    return escapeHtml(code);
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
