import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "cheki - Verify Ethiopian Receipts",
    short_name: "cheki",
    description:
      "Free, open-source Ethiopian bank receipt verification. Verify CBE, Telebirr, BOA, M-Pesa, and more. No signup, no API key.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#16a34a",
    orientation: "portrait-primary",
    categories: ["finance", "business", "utilities", "productivity"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
