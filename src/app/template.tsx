/**
 * Next.js App Router template - re-mounts on every navigation.
 * Wraps each route in a page-enter animation adapted from
 * transitions.dev's page side-by-side pattern.
 *
 * Uses CSS animation (not transition) so it plays on mount without
 * needing a exit/unmount coordination. Respects prefers-reduced-motion
 * via the .t-page-enter media query in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="t-page-enter">{children}</div>;
}
