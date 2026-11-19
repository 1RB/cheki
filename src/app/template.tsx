/**
 * Next.js App Router template - re-mounts on every navigation.
 * Wraps each route in a page-enter animation (opacity only, see
 * .t-page-enter in globals.css). The entrance layer for the parts of each
 * section is pure CSS (a view timeline in globals.css), so it needs no
 * script here and respects prefers-reduced-motion on its own.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="t-page-enter">{children}</div>;
}
