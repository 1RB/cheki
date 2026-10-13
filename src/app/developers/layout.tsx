import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Guide - Receipt Verification SDK for TypeScript and Python",
  description:
    "Integrate cheki's free receipt verification API: a TypeScript SDK, a Python library, Go, PHP and Dart SDKs, a CLI and Docker self-hosting. No API key.",
  alternates: {
    canonical: "/developers",
  },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title: "cheki Developer Guide - Integrate Ethiopian Receipt Verification",
    description:
      "Free REST API, 5 SDKs, CLI tool, and Docker self-hosting. No API key, no signup, per-IP rate limits.",
    type: "website",
    url: "https://cheki.et/developers",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki Developer Guide - Integrate Ethiopian Receipt Verification",
    description:
      "Free REST API, 5 SDKs, CLI tool, and Docker self-hosting. No API key, no signup.",
  },
};

export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
