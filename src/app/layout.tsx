import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cheki — free ethiopian receipt verification",
  description:
    "Verify Ethiopian bank and mobile wallet receipts for free. No signup. No API key. No scam. The bank receipt endpoints are public. We just parse them.",
  keywords: ["ethiopia", "receipt", "verification", "cbe", "telebirr", "bank", "free"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
