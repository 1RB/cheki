import { ImageResponse } from "next/og";
import { indexableSeoPages, getSeoPage } from "@/lib/seo-pages";
import { getBank } from "@/lib/banks";
import { Frame, Headline, ResultCard, OG_SIZE, ogFonts } from "@/lib/og/card";

export const runtime = "nodejs";
export const alt = "cheki: Ethiopian receipt verification";
export const size = OG_SIZE;
export const contentType = "image/png";
// Built for every indexable guide page at build time; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return indexableSeoPages.map((p) => ({ slug: p.slug }));
}

// Guide pages: the page's own H1 as the headline, under a quiet kicker naming
// the bank (or "Guide"). Pages about one bank show that bank's verified
// result; general guides show CBE's. The receipt is always synthetic: these
// pages are articles, not receipts, and the card never carries receipt data.
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  const title = page?.h1 ?? "Verify Ethiopian receipts";
  const bank = page?.bankCode ? getBank(page.bankCode) : undefined;
  const cardBank = bank && bank.status === "live" ? bank : getBank("cbe");
  const kicker = bank ? `${bank.shortName} guide` : "Guide";

  return new ImageResponse(
    (
      <Frame
        left={
<Headline kicker={kicker} lead={title} size={title.length > 34 ? 52 : 58} />
        }
        right={<ResultCard code={cardBank?.code ?? "cbe"} shortName={cardBank?.shortName ?? "CBE"} />}
      />
    ),
    { ...size, fonts: await ogFonts() }
  );
}
