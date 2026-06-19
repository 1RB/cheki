import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Guide - Integrate Ethiopian Receipt Verification",
  description:
    "Integrate cheki's free receipt verification API into your app. Code examples in cURL, JavaScript, Python, TypeScript, CLI. Self-hosting with Docker. SDKs for 5 languages.",
  alternates: {
    canonical: "/developers",
  },
  openGraph: {
    title: "cheki Developer Guide - Integrate Ethiopian Receipt Verification",
    description:
      "Free REST API, 5 SDKs, CLI tool, and Docker self-hosting. No API key, no signup, no rate limit.",
    type: "website",
    url: "https://cheki.app/developers",
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
