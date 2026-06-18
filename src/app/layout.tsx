import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cheki — verify ethiopian receipts for free",
  description:
    "Free Ethiopian bank receipt verification. No signup. No API key. No scam. check.et and verify.et charge you for public data. We give it away.",
  keywords: ["ethiopia", "receipt", "verification", "cbe", "telebirr", "bank", "free", "cheki"],
  openGraph: {
    title: "cheki — verify ethiopian receipts for free",
    description: "No signup. No API key. No scam. The bank receipt endpoints are public. We just parse them.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me" />
      </head>
      <body>{children}</body>
    </html>
  );
}
