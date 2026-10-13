import type { Metadata } from "next";

// /compare is the one comparison page: the comparison guide and
// /verify/cheki-vs-check-et-vs-verify-et 301 here, so the title and
// description carry the "check.et vs verify.et" searches too.
const title = "check.et vs verify.et vs cheki: services compared";
const description =
  "cheki vs check.et, verify.et, qbirr, tinaverify and tally: price, banks, API and openness compared. All six use the same public bank endpoints.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title,
    description,
    type: "website",
    url: "https://cheki.et/compare",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
