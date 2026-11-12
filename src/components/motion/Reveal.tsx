"use client";

import { useEffect } from "react";

/**
 * The entrance layer: the parts of each section (heading, then text, then
 * picture) rise 24px and fade in once, staggered, as they come into view.
 *
 * - Only what is below the first screen at mount is touched; the first screen
 *   paints as the server sent it, so nothing on it (or LCP) waits on script.
 * - Without script, under prefers-reduced-motion and in print, nothing is
 *   hidden: the hidden state lives in globals.css behind html[data-rv] inside
 *   @media (prefers-reduced-motion: no-preference).
 * - Transform and opacity only; the transform is gone once a part has entered,
 *   so nothing is left trapping position: fixed descendants.
 * - The checker (.vp) is never animated: it is a control, not decoration.
 *
 * Mounted from src/app/template.tsx, so it runs again on every navigation.
 */
const PARTS = "main :is(h2, h3, p, li, pre, table, details, dl, .photo, [data-ui], .code-block, .rv-part)";
const MAX_PARTS = 400;

export function Reveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fold = window.innerHeight;
    const picked: HTMLElement[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(PARTS)) {
      if (picked.length >= MAX_PARTS) break;
      if (el.closest(".vp, nav, [role='dialog'], [data-rv]")) continue;
      if (el.querySelector(".vp")) continue;
      // An ancestor already enters as one part: its children ride along.
      if (picked.some((p) => p.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (r.top < fold || r.height === 0) continue;
      picked.push(el);
    }
    if (!picked.length) return;
    for (const el of picked) el.setAttribute("data-rv", "");
    document.documentElement.setAttribute("data-rv", "");

    const io = new IntersectionObserver(
      (entries) => {
        const arriving = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        arriving.forEach((el, i) => {
          el.style.setProperty("--rv-d", `${Math.min(i, 6) * 70}ms`);
          el.setAttribute("data-rv", "in");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    for (const el of picked) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
