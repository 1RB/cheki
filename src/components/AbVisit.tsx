"use client";

import { Analytics } from "@vercel/analytics/next";
import type { OgArm } from "@/lib/og/ab";

/**
 * Records one cookieless page view for an A/B share link, reported as
 * "/ab/{arm}" so the two arms show up as separate pages in Vercel Web
 * Analytics. Mounted only on /ab/[v]; the rest of the site loads no analytics.
 * Anything after the first view (client navigation away) is dropped.
 */
export function AbVisit({ arm }: { arm: OgArm }) {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        // "/" via the "/?v=" rewrite, or /ab/{arm} if opened directly.
        if (url.pathname !== "/" && url.pathname !== `/ab/${arm}`) return null;
        return { ...event, url: `${url.origin}/ab/${arm}` };
      }}
    />
  );
}
