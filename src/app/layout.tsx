import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";

const SITE_URL = "https://cheki.et";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Check Ethiopian Bank Receipts Free: CBE, Telebirr & More | cheki",
    template: "%s | cheki",
  },
  description:
    "Check CBE, Telebirr, BOA, Dashen, Awash, M-Pesa, Zemen and eBirr receipts in seconds against each bank's own record. Free, no signup, open-source API.",
  applicationName: "cheki",
  category: "finance",
  creator: "cheki open source",
  publisher: "cheki open source",
  authors: [{ name: "cheki open source", url: "https://github.com/1RB/cheki" }],
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
      "Check CBE, Telebirr and 8 more Ethiopian bank and wallet receipts in seconds. Free, no signup, open source.",
    type: "website",
    siteName: "cheki",
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Check Ethiopian Bank Receipts Free | cheki",
    description:
      "Check CBE, Telebirr and 8 more Ethiopian bank and wallet receipts in seconds. Free, no signup, open source.",
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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  verification: {
    google: "5PHbiqRW6j2_qQfFDxJObwOBQjKDeHOA8JG2FbzOvWI",
  },
};

// Structured data. Rendered as real <script type="application/ld+json"> tags
// in <head>: the previous `metadata.other` entries were emitted as <meta>
// tags, which Google does not read as structured data.
const ldOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "cheki",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  description:
    "Free, open-source Ethiopian bank receipt verification service.",
  sameAs: [
    "https://github.com/1RB/cheki",
    "https://www.npmjs.com/package/cheki-verify",
    "https://pypi.org/project/cheki/",
  ],
  foundingDate: "2026",
};

const ldWebsite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "cheki",
  alternateName: ["cheki.et", "Cheki"],
  url: `${SITE_URL}/`,
};

const ldWebapp = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "cheki",
  url: SITE_URL,
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
    "Batch verification up to 50 receipts",
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
    <html lang="en">
      <head>
        {/* Self-hosted: an origin the page has never visited costs DNS + TLS
            before the first paint. Preloaded because a swap-phase font is a
            guaranteed flash of fallback text. */}
        <link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldOrganization) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldWebsite) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldWebapp) }} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <style>{`
          html { background: var(--bg); }
          ::view-transition-old(root), ::view-transition-new(root) {
            animation: none; mix-blend-mode: normal;
          }
          ::view-transition-old(root) { z-index: 1; }
          ::view-transition-new(root) { z-index: 9999; }
          nav { view-transition-name: nav; }
          ::view-transition-old(nav) { animation: none; }
          ::view-transition-new(nav) { animation: none; }
        `}</style>
        <Script
          id="cheki-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('cheki-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s||((d?'dark':'light'));document.documentElement.setAttribute('data-theme',t);}catch(e){}})();` }}
        />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
