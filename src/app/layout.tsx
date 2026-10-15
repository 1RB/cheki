import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LIVE_BANK_COUNT, liveBankList } from "@/lib/bank-counts";
import { I18nProvider } from "@/lib/i18n/context";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCALE_INIT_SCRIPT } from "@/lib/i18n/locale-store";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { analyticsPaths } from "@/lib/analytics/paths";
import { ORGANIZATION_ID, organizationJsonLd, sourceCodeJsonLd, websiteJsonLd } from "@/lib/site-schema";

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
    default: "Check Ethiopian Bank Receipts Free: CBE, Telebirr & More | cheki",
    template: "%s | cheki",
  },
  description:
    `Check ${liveBankList("short")} receipts in seconds against each bank's own record. Free, no signup, open-source API.`,
  applicationName: "cheki",
  category: "finance",
  creator: "cheki open source",
  publisher: "cheki open source",
  authors: [{ name: "1RB", url: "https://github.com/1RB" }],
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
    title: "Check Ethiopian Bank Receipts Free | cheki",
    description:
      `Check CBE, Telebirr and ${LIVE_BANK_COUNT - 2} more Ethiopian bank and wallet receipts in seconds. Free, no signup, open source.`,
    type: "website",
    siteName: "cheki",
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Check Ethiopian Bank Receipts Free | cheki",
    description:
      `Check CBE, Telebirr and ${LIVE_BANK_COUNT - 2} more Ethiopian bank and wallet receipts in seconds. Free, no signup, open source.`,
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
// WebSite and source-code nodes live in src/lib/site-schema.ts.
const ldWebapp = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "cheki.et",
  url: SITE_URL,
  publisher: { "@id": ORGANIZATION_ID },
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "ETB",
  },
  description:
    "Free, open-source Ethiopian bank receipt verification. Verify CBE, Telebirr, BOA, M-Pesa, and more. No signup, no API key required.",
  featureList: [
    "Real-time receipt verification",
    "QR code scanning",
    "Batch verification up to 20 receipts",
    "REST API with no authentication",
    "TypeScript, Python, Dart, PHP, and Go SDKs",
    "Self-hosting with Docker",
    "Bank receipt endpoint health monitoring",
  ],
};

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldWebapp) }} />
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
