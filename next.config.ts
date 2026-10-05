import type { NextConfig } from "next";

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
