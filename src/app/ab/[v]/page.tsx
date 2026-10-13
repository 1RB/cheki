import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeRoute from "@/app/page";
import { OG_ARMS, isOgArm } from "@/lib/og/ab";
import { AbVisit } from "@/components/AbVisit";

// Reached through the "/?v=a|b" rewrite in next.config.ts (see src/lib/og/ab.ts).
// Same page as "/", only the shared card differs; built statically per arm.
export const dynamicParams = false;

export function generateStaticParams() {
  return OG_ARMS.map((v) => ({ v }));
}

export const metadata: Metadata = {
  // One copy of the home page in the index: these are share links, not pages.
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default async function AbHome({ params }: { params: Promise<{ v: string }> }) {
  const { v } = await params;
  if (!isOgArm(v)) notFound();
  return (
    <>
      <HomeRoute />
      <AbVisit arm={v} />
    </>
  );
}
