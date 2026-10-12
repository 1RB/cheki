import { ImageResponse } from "next/og";
import { banks, getBank } from "@/lib/banks";
import { Frame, Headline, LogoMark, ResultCard, OG_SIZE, ogFonts, withArticle } from "@/lib/og/card";

export const runtime = "nodejs";
export const alt = "cheki: verify a bank receipt against the bank's own record";
export const size = OG_SIZE;
export const contentType = "image/png";
// Every bank page has its card built at build time; unknown codes 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return banks.map((b) => ({ code: b.code }));
}

// "Verify a {Bank} receipt" and that bank's verified result. Beta banks say
// so in quiet text; banks still in development show only their mark, since a
// verified result would claim something cheki cannot do for them yet.
export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bank = getBank(code);
  const name = bank?.shortName ?? code.toUpperCase();
  const live = bank?.status === "live";
  const note = !live ? "In development" : bank?.beta ? "Beta" : undefined;
  const fullName = bank?.name ?? name;
  const kicker = (
    <>
      {!live && <div style={{ display: "flex", marginRight: 14 }}><LogoMark code={code} size={30} /></div>}
      <span>{note ? `${fullName} · ${note}` : fullName}</span>
    </>
  );

  return new ImageResponse(
    (
      <Frame
        left={<Headline kicker={kicker} lead={`Verify ${withArticle(name)} receipt`} rest={`against ${name}’s own record.`} size={live ? 60 : 72} />}
        right={live ? <ResultCard code={code} shortName={name} /> : undefined}
      />
    ),
    { ...size, fonts: await ogFonts() }
  );
}
