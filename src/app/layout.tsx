import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";

const SITE_URL = "https://chekiapp.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "cheki - verify ethiopian receipts for free",
    template: "%s | cheki",
  },
  description:
    "Free, open-source Ethiopian bank receipt verification. Verify CBE, Telebirr, BOA, M-Pesa, and more. No signup, no API key, no scam. The bank receipt endpoints are public. We just parse them.",
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
    title: "cheki - verify ethiopian receipts for free",
    description:
      "No signup. No API key. No scam. The bank receipt endpoints are public. We just parse them.",
    type: "website",
    siteName: "cheki",
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "cheki - verify ethiopian receipts for free",
    description:
      "No signup. No API key. No scam. The bank receipt endpoints are public. We just parse them.",
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
  other: {
    // JSON-LD structured data - Organization
    "script:ld+json:organization": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "cheki",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.ico`,
      description:
        "Free, open-source Ethiopian bank receipt verification service.",
      sameAs: ["https://github.com/1RB/cheki"],
      foundingDate: "2025",
    }),
    // JSON-LD structured data - WebApplication
    "script:ld+json:webapp": JSON.stringify({
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
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5",
        ratingCount: "1",
      },
    }),
    // JSON-LD structured data - FAQPage
    "script:ld+json:faq": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is cheki really free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. cheki is 100% free with no limits. No signup, no API key, no credit card. You can verify unlimited receipts. check.et charges 499 ETB/month after 200 verifications. verify.et charges $20-40/month.",
          },
        },
        {
          "@type": "Question",
          name: "How does receipt verification work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Every Ethiopian bank and mobile wallet publishes transaction receipts at publicly accessible URLs. These URLs require no authentication. cheki fetches these URLs, parses the response (PDF, HTML, or JSON), and returns clean structured JSON with sender name, receiver name, amount, date, and reference number.",
          },
        },
        {
          "@type": "Question",
          name: "Which banks are supported?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "cheki supports 9 live banks and wallets: CBE, Telebirr, Bank of Abyssinia, M-Pesa, Dashen Bank, Awash Bank, Zemen Bank, CBE Birr, and Siinqee Bank. Additional banks are in development and can be added by the community.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need an API key?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. cheki's API requires no authentication. No API key, no bearer token, no OAuth. Just POST to /api/verify with a JSON body containing the bank code, reference number, and (for some banks) the account number.",
          },
        },
        {
          "@type": "Question",
          name: "Can I self-host cheki?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. cheki is MIT licensed and includes Docker support. Clone the repo, run docker-compose up, and the API is available at localhost:3000. Self-hosting on an Ethiopian IP also bypasses geo-blocks on Telebirr and M-Pesa endpoints.",
          },
        },
        {
          "@type": "Question",
          name: "How is cheki different from check.et and verify.et?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "All services use the same public bank endpoints. cheki is free and open source (MIT). check.et charges 499 ETB/month. verify.et charges $20-40/month. cheki requires no signup, shows the source URL, allows AI crawlers, and can be self-hosted.",
          },
        },
      ],
    }),
  },
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
        <link rel="preconnect" href="https://rsms.me" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
