import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation - Free Receipt Verification REST API",
  description:
    "Free REST API for verifying Ethiopian bank receipts. No auth, no rate limit, no API key. POST /api/verify with bank code and reference. TypeScript, Python, Dart, PHP, Go SDKs.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "cheki API Documentation - Free Receipt Verification REST API",
    description:
      "Free REST API for verifying Ethiopian bank receipts. No auth, no rate limit. Supports CBE, Telebirr, BOA, M-Pesa, and more.",
    type: "website",
    url: "https://cheki.app/docs",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki API Documentation - Free Receipt Verification REST API",
    description:
      "Free REST API for verifying Ethiopian bank receipts. No auth, no rate limit.",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
