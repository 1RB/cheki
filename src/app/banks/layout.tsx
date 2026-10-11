import type { Metadata } from "next";
import { LIVE_BANK_COUNT, liveBankList } from "@/lib/bank-counts";

export const metadata: Metadata = {
  // An object title keeps the " | cheki" suffix on /banks/[code] pages; a plain
  // string here dropped the root template for every child segment.
  title: {
    default: "Supported Banks and Wallets - CBE, Telebirr, BOA, M-Pesa & More",
    template: "%s | cheki",
  },
  description:
    `All Ethiopian banks and mobile wallets supported by cheki for free receipt verification. Live now: ${liveBankList("short")}.`,
  alternates: {
    canonical: "/banks",
  },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title: "cheki - Supported Ethiopian Banks and Wallets",
    description:
      `${LIVE_BANK_COUNT} live banks and wallets supported for free receipt verification. CBE, Telebirr, BOA, M-Pesa, and more.`,
    type: "website",
    url: "https://cheki.et/banks",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki - Supported Ethiopian Banks and Wallets",
    description:
      `${LIVE_BANK_COUNT} live banks and wallets supported for free receipt verification.`,
  },
};

export default function BanksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
