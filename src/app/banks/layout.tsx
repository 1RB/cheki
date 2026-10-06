import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supported Banks and Wallets - CBE, Telebirr, BOA, M-Pesa & More",
  description:
    "All Ethiopian banks and mobile wallets supported by cheki for free receipt verification. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee.",
  alternates: {
    canonical: "/banks",
  },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title: "cheki - Supported Ethiopian Banks and Wallets",
    description:
      "10 live banks and wallets supported for free receipt verification. CBE, Telebirr, BOA, M-Pesa, and more.",
    type: "website",
    url: "https://cheki.et/banks",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki - Supported Ethiopian Banks and Wallets",
    description:
      "10 live banks and wallets supported for free receipt verification.",
  },
};

export default function BanksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
