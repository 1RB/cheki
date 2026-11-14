import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DIRECT_BANK_COUNT, directBankList, linkOutBankList } from "@/lib/bank-counts";
import { I18nProvider } from "@/lib/i18n/context";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCALE_INIT_SCRIPT } from "@/lib/i18n/locale-store";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { analyticsPaths } from "@/lib/analytics/paths";
import { BRAND, TITLE_TEMPLATE, organizationJsonLd, sourceCodeJsonLd, webApplicationJsonLd, websiteJsonLd } from "@/lib/site-schema";

const SITE_URL = "https://cheki.et";

// Latin subset of Inter (46 KB, wght 400-800), built by scripts/subset-font.sh
// from the full 352 KB variable font. `display: optional` means a slow
// connection keeps the metric-matched fallback for this page view instead of
// repainting the hero when the font lands: the swap was the LCP.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "400 800",
  style: "normal",
  display: "optional",
  variable: "--font-inter",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // The home answers "bank receipt check ethiopia" / "receipt checker
    // ethiopia"; the H1 says the same thing (hero.titleLead).
    default: `Check Ethiopian Bank Receipts Free: CBE, Telebirr | ${BRAND}`,
    template: TITLE_TEMPLATE,
  },
  description:
    `Check ${directBankList("short")} receipts against each bank's own record. ${linkOutBankList()} open on their official receipt pages. Free, no signup, open source.`,
  applicationName: BRAND,
  category: "finance",
  creator: BRAND,
  publisher: BRAND,
  authors: [{ name: "Ray (@1RB)", url: "https://github.com/1RB" }],
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
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `Check Ethiopian Bank Receipts Free | ${BRAND}`,
    description:
      `Check CBE, BOA and ${DIRECT_BANK_COUNT - 2} more Ethiopian bank and wallet receipts against the bank's own record. ${linkOutBankList()} open on their official receipt pages. Free, open source.`,
    type: "website",
    siteName: BRAND,
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `Check Ethiopian Bank Receipts Free | ${BRAND}`,
    description:
      `Check CBE, BOA and ${DIRECT_BANK_COUNT - 2} more Ethiopian bank and wallet receipts against the bank's own record. ${linkOutBankList()} open on their official receipt pages. Free, open source.`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Icons come from the file conventions in src/app: favicon.ico (16/32/48),
  // icon.png (512) and apple-icon.png (180), all derived from public/logo.png.
  verification: {
    google: "5PHbiqRW6j2_qQfFDxJObwOBQjKDeHOA8JG2FbzOvWI",
  },
};

// Structured data. Rendered as real <script type="application/ld+json"> tags
// in <head>: the previous `metadata.other` entries were emitted as <meta>
// tags, which Google does not read as structured data. The Organization,
// WebSite, WebApplication and source-code nodes live in src/lib/site-schema.ts.

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sourceCodeJsonLd) }} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <style>{`
          html { background: var(--bg); }
          ::view-transition-old(root), ::view-transition-new(root) {
            animation: none; mix-blend-mode: normal;
          }
          ::view-transition-old(root) { z-index: 1; }
          ::view-transition-new(root) { z-index: 9999; }
        `}</style>
        {/* Theme and language-control state before first paint. A plain inline script, not next/script:
            beforeInteractive defers inline code to the Next runtime, so a
            stored theme that differed from the OS flashed the wrong palette. */}
        <script id="cheki-theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script id="cheki-locale-init" dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
        {/* Cookieless page-view counts; see src/lib/analytics/url.ts for what an event may carry. */}
        <SiteAnalytics paths={analyticsPaths()} />
      </body>
    </html>
  );
}
