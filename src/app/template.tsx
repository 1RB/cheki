import { Reveal } from "@/components/motion/Reveal";

/**
 * Next.js App Router template - re-mounts on every navigation.
 * Wraps each route in a page-enter animation (opacity only, see
 * .t-page-enter in globals.css) and mounts the entrance layer, which reads
 * the new page's parts once it is in the DOM. Both respect
 * prefers-reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-page-enter">
      {children}
      <Reveal />
    </div>
  );
}
