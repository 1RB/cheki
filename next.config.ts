import type { NextConfig } from "next";
import manifest from "./src/lib/manifest/banks.json";

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
      { source: `/verify/verify-${b.id}-receipt-online`, destination, permanent: true },
      { source: `/verify/check-${b.id}-payment-online`, destination, permanent: true },
    ];
  });

const nextConfig: NextConfig = {
  // OCR image uploads can be large; Vercel's serverless limit is 4.5MB,
  // so we rely on the client to resize. The API route validates size.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // Keep native/self-contained packages external so QR decoding and sharp work.
  serverExternalPackages: ["sharp", "jsqr"],
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
