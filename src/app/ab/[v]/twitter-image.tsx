// x:image uses the same art as og:image for this arm. Route config is declared
// here rather than re-exported, since Next reads it statically per file.
import { OG_ARMS } from "@/lib/og/ab";
export { default, alt, size, contentType } from "./opengraph-image";

export const runtime = "nodejs";
export const dynamicParams = false;

export function generateStaticParams() {
  return OG_ARMS.map((v) => ({ v }));
}
