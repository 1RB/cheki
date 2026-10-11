/**
 * Linear-time HTML helpers for the parsers.
 *
 * `/<[^>]+>/g` is quadratic on input with many "<" and no ">" (each "<" scans
 * to the end of the string), and `/<script[^>]*>[\s\S]*?<\/script>/gi` is
 * quadratic on many unclosed "<script" tags. Both were reachable from
 * /api/parse with attacker-chosen text. These helpers do the same job in
 * linear time.
 */

/** Matches one tag. Stops at the next "<", so a stray "<" can't scan ahead. */
export const TAG_RE = /<[^<>]*>/g;

/** Remove <script>...</script> and <style>...</style> blocks (case-insensitive). */
export function removeScriptsAndStyles(html: string): string {
  let out = html;
  for (const tag of ["script", "style"]) {
    const lower = out.toLowerCase();
    const open = `<${tag}`;
    const close = `</${tag}`;
    let result = "";
    let pos = 0;
    for (;;) {
      const start = lower.indexOf(open, pos);
      if (start === -1) {
        result += out.slice(pos);
        break;
      }
      result += out.slice(pos, start);
      const end = lower.indexOf(close, start + open.length);
      if (end === -1) {
        // Unclosed block: drop the rest, like a browser would.
        break;
      }
      const gt = lower.indexOf(">", end);
      pos = gt === -1 ? lower.length : gt + 1;
    }
    out = result;
  }
  return out;
}
