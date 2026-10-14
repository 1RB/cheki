"use client";

import { useCallback, useMemo } from "react";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { analyticsUrl } from "@/lib/analytics/url";

/**
 * Cookieless Vercel Web Analytics for the whole site, mounted once in the root
 * layout. Each page view is reduced by analyticsUrl to a known page path with
 * no query string or fragment (A/B share links reported as "/ab/{arm}"), and
 * anything else is dropped, so no receipt reference or link reaches it.
 */
export function SiteAnalytics({ paths }: { paths: string[] }) {
  const known = useMemo(() => new Set(paths), [paths]);
  // Stable, so the component registers it once rather than on every render.
  const beforeSend = useCallback(
    (event: BeforeSendEvent): BeforeSendEvent | null => {
      const url = analyticsUrl(event.url, known);
      return url === null ? null : { ...event, url };
    },
    [known],
  );
  return <Analytics beforeSend={beforeSend} />;
}
