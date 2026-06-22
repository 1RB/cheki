import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OCR image uploads can be large; Vercel's serverless limit is 4.5MB,
  // so we rely on the client to resize. The API route validates size.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
