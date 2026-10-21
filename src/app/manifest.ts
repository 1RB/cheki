import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "cheki - Verify Ethiopian Receipts",
    short_name: "cheki",
    description:
      "Free, open-source Ethiopian bank receipt verification. Checks CBE, BOA, Dashen and more with the bank; Telebirr and M-Pesa open on their official receipt pages. No signup, no API key.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#16a34a",
    orientation: "portrait-primary",
    categories: ["finance", "business", "utilities", "productivity"],
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
