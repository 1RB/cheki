import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "cheki vs check.et vs verify.et vs qbirr vs tinaverify vs tally - Full Comparison",
  description:
    "Detailed comparison of Ethiopia's six receipt verification services. Pricing, features, banks, API, and transparency. cheki is free and open source; the rest charge for the same public data.",
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title:
      "cheki vs check.et vs verify.et vs qbirr vs tinaverify vs tally - Full Comparison",
    description:
      "Six receipt verification services in Ethiopia. All use the same public bank endpoints. One is free and open source.",
    type: "website",
    url: "https://chekiapp.vercel.app/compare",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "cheki vs check.et vs verify.et vs qbirr vs tinaverify vs tally - Full Comparison",
    description:
      "Six receipt verification services in Ethiopia. All use the same public bank endpoints. One is free and open source.",
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
