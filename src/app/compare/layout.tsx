import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Ethiopian receipt verification services",
  description:
    "Compare six Ethiopian receipt verification services by pricing, features, banks, API, and transparency. All use the same public bank endpoints.",
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title:
      "Compare Ethiopian receipt verification services",
    description:
      "Six receipt verification services in Ethiopia. All use the same public bank endpoints. Compare pricing, features, and transparency.",
    type: "website",
    url: "https://chekiapp.vercel.app/compare",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Compare Ethiopian receipt verification services",
    description:
      "Six receipt verification services in Ethiopia. All use the same public bank endpoints. Compare pricing, features, and transparency.",
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
