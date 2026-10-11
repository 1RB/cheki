"use client";

/**
 * Client-only, because /status is prerendered: "now" at build time says
 * nothing about how old the snapshot is when someone reads it. Renders
 * nothing on the server and during hydration (space is reserved by .st-meta).
 */
import { useNow } from "@/lib/time/use-now";
import { isStale } from "@/lib/status-view";

export function StaleNote({ generatedAt }: { generatedAt: string }) {
  const now = useNow();
  if (now === 0 || !isStale(generatedAt, now)) return null;
  return <span className="st-stale"> · may be stale</span>;
}
