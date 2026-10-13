import type { NextConfig } from "next";
import manifest from "./src/lib/manifest/banks.json";
import { OG_ARMS } from "./src/lib/og/ab";

// Per-bank /verify pages merged into /banks/[code] (see MERGED_INTO_BANK_PAGE
// in src/lib/seo-pages.ts). Live providers go to their own bank page, which now
// carries the checker and the merged content. Providers still in development
// go to the /banks list: their individual pages are noindexed until live.
const PARSER_ONLY_IDS = new Set(["cbe-new"]);
const mergedBankRedirects = (manifest as { id: string; status: string }[])
  .filter((b) => !PARSER_ONLY_IDS.has(b.id))
  .flatMap((b) => {
    const destination = b.status === "live" ? `/banks/${b.id}` : "/banks";
    return [
      // statusCode 301 rather than permanent: true (which Next sends as 308):
      // these are old indexed URLs, and 301 is the code crawlers and link
      // checkers expect for a page that moved for good.
      { source: `/verify/verify-${b.id}-receipt-online`, destination, statusCode: 301 as const },
      { source: `/verify/check-${b.id}-payment-online`, destination, statusCode: 301 as const },
    ];
  });

const nextConfig: NextConfig = {
  // OCR image uploads go to /api/ocr (a route handler, not a server action):
  // Vercel's body limit is 4.5MB, the client resizes first and the route
  // validates the size. There are no server actions, so no serverActions config.
  // Keep native/self-contained packages external so QR decoding and sharp work.
  serverExternalPackages: ["sharp", "jsqr"],
  // Share-link A/B test for the home card (src/lib/og/ab.ts): "/?v=a" serves
  // /ab/a, whose only difference is its og:image. beforeFiles so it wins over
  // the "/" page; the address bar keeps "/?v=a".
  async rewrites() {
    return {
      beforeFiles: OG_ARMS.map((v) => ({
        source: "/",
        has: [{ type: "query" as const, key: "v", value: v }],
        destination: `/ab/${v}`,
      })),
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      ...mergedBankRedirects,
      {
        // cheki.et is the canonical home. chekiapp.vercel.app was only ever
        // the deployment address, so permanent-redirect it rather than serve
        // a second copy of the site from two hosts.
        source: "/:path*",
        has: [{ type: "host", value: "chekiapp.vercel.app" }],
        destination: "https://cheki.et/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
