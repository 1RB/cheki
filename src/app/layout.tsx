import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "cheki — verify ethiopian receipts for free",
    template: "%s | cheki",
  },
  description:
    "Free, open-source Ethiopian bank receipt verification. Verify CBE, Telebirr, BOA, M-Pesa, and more. No signup, no API key, no scam. The bank receipt endpoints are public — we just parse them.",
  keywords: [
    "ethiopian receipt verification",
    "verify CBE transaction",
    "verify telebirr receipt",
    "ethiopian bank receipt verify",
    "free receipt verification ethiopia",
    "CBE FT reference verify",
    "telebirr transaction check",
    "cheki",
    "ethiopian payment verification API",
    "bank receipt checker ethiopia",
  ],
  authors: [{ name: "cheki open source" }],
  openGraph: {
    title: "cheki — verify ethiopian receipts for free",
    description: "No signup. No API key. No scam. The bank receipt endpoints are public. We just parse them.",
    type: "website",
    siteName: "cheki",
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki — verify ethiopian receipts for free",
    description: "No signup. No API key. No scam. The bank receipt endpoints are public. We just parse them.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
