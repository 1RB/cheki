import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation - Free Receipt Verification REST API",
  description:
    "Free REST API for Ethiopian bank receipts: single and batch verification, bank list and health check. No API key, per-IP rate limits. SDKs in 5 languages.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title: "cheki API Documentation - Free Receipt Verification REST API",
    description:
      "Free REST API for verifying Ethiopian bank receipts. No auth, no API key, per-IP rate limits. Checks CBE, BOA, Dashen and more with the bank; for Telebirr and M-Pesa it returns the official receipt link.",
    type: "website",
    url: "https://cheki.et/docs",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki API Documentation - Free Receipt Verification REST API",
    description:
      "Free REST API for verifying Ethiopian bank receipts. No auth, per-IP rate limits.",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
