import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides - Ethiopian Receipt Verification, Fraud Detection, API Integration",
  description:
    "Practical guides on Ethiopian receipt verification, payment fraud detection, API integration, and open source fintech. CBE, Telebirr, BOA, M-Pesa guides. No paywall, no fluff.",
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    title: "cheki Guides - Ethiopian Receipt Verification Articles",
    description:
      "Practical guides on Ethiopian receipt verification, payment fraud, API integration, and open source fintech.",
    type: "website",
    url: "https://chekiapp.vercel.app/guides",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki Guides - Ethiopian Receipt Verification Articles",
    description:
      "Practical guides on receipt verification, fraud detection, and API integration.",
  },
};

export default function GuidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
