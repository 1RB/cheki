import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OCR image uploads can be large; Vercel's serverless limit is 4.5MB,
  // so we rely on the client to resize. The API route validates size.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // Keep native/self-contained packages external so Tesseract's worker script
  // and sharp binaries are found at runtime.
  serverExternalPackages: ["tesseract.js", "sharp", "jsqr"],
};

export default nextConfig;
