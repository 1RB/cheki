import type { Metadata } from "next";
import { coverageSentence, directBankList, linkOutBankList } from "@/lib/bank-counts";

export const metadata: Metadata = {
  // An object title keeps the " | cheki" suffix on /banks/[code] pages; a plain
  // string here dropped the root template for every child segment.
  title: {
    default: "Supported Banks and Wallets - CBE, Telebirr, BOA, M-Pesa & More",
    template: "%s | cheki",
  },
  description:
    `Free Ethiopian receipt verification. Checked with the bank: ${directBankList("short")}. ${linkOutBankList()} open on their official receipt pages.`,
  alternates: {
    canonical: "/banks",
  },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title: "cheki - Supported Ethiopian Banks and Wallets",
    description:
      `${coverageSentence()}. Free receipt verification.`,
    type: "website",
    url: "https://cheki.et/banks",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki - Supported Ethiopian Banks and Wallets",
    description:
      `${coverageSentence()}. Free receipt verification.`,
  },
};

export default function BanksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
