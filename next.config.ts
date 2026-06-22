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
};

export default nextConfig;
