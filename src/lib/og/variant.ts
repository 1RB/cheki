/**
 * Which Open Graph design the home and bank cards use. One switch for the
 * whole exploration (PR "seo/og-explore"):
 *
 *   OG_VARIANT=stamp npm run build      # or set it on Vercel
 *
 * "current" (the default) is the shipped design from PR #43 and renders
 * byte-for-byte as before. The others live in src/lib/og/concepts.
 */
export const OG_VARIANTS = [
  "current",
  // round 1: drawn objects (src/lib/og/concepts/{stamp,spot,banknote,chat,paid}.tsx)
  "stamp", "spot", "banknote", "chat", "paid",
  // round 2: one emotion, one hero image (src/lib/og/concepts/photo.tsx, art in public/og)
  "light", "lineup", "bait", "check",
  // round 4: old masters and dithering (src/lib/og/concepts/painted.tsx, art in public/og)
  "moneylender", "pixels", "bitmap", "ember",
] as const;
export type OgVariant = (typeof OG_VARIANTS)[number];

export function resolveOgVariant(value: string | undefined): OgVariant {
  const v = (value ?? "").trim().toLowerCase();
  return (OG_VARIANTS as readonly string[]).includes(v) ? (v as OgVariant) : "current";
}

export const OG_VARIANT: OgVariant = resolveOgVariant(process.env.OG_VARIANT);
