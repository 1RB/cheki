/**
 * Static search index for the ⌘K palette: titles and one-line descriptions
 * only. Built once at build time, fetched by the palette the first time it
 * opens, so neither the guides corpus nor the bank manifest ships in the
 * site-wide client bundle.
 */
import { NextResponse } from "next/server";
import { banks } from "@/lib/banks";
import { articles } from "@/lib/guides";

export const dynamic = "force-static";

type SearchItem = { id: string; label: string; description?: string; href: string; group: string };

const PAGES: SearchItem[] = [
  { id: "page-verify", href: "/", label: "Check a receipt", group: "Pages" },
  { id: "page-banks", href: "/banks", label: "All banks", group: "Pages" },
  { id: "page-guides", href: "/guides", label: "All guides", group: "Pages" },
  { id: "page-docs", href: "/docs", label: "API documentation", group: "Pages" },
  { id: "page-compare", href: "/compare", label: "Compare services", group: "Pages" },
  { id: "page-developers", href: "/developers", label: "Developers", group: "Pages" },
  { id: "page-verify-index", href: "/verify", label: "Verify guides", group: "Pages" },
  { id: "page-endpoints", href: "/endpoints", label: "Bank endpoint reference", group: "Pages" },
  { id: "page-status", href: "/status", label: "Bank status", group: "Pages" },
];

export function GET() {
  const items: SearchItem[] = [
    ...PAGES,
    ...banks.map((b) => ({
      id: `bank-${b.code}`,
      label: b.name,
      description: b.status === "live" ? "Live" : "In development",
      href: `/banks/${b.code}`,
      group: "Banks",
    })),
    ...articles.map((a) => ({
      id: `guide-${a.slug}`,
      label: a.title,
      description: a.excerpt.length > 140 ? `${a.excerpt.slice(0, 137)}...` : a.excerpt,
      href: `/guides/${a.slug}`,
      group: "Guides",
    })),
  ];
  return NextResponse.json(items, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
