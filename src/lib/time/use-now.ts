"use client";

/**
 * One shared minute clock for every relative timestamp on the page.
 *
 * - A single timer, started by the first subscriber and stopped with the last,
 *   aligned to the wall-clock minute so every "x min ago" turns over together.
 * - Paused while the tab is hidden; on return it ticks once immediately.
 * - The snapshot is the current minute, so React re-renders the subscribed
 *   <RelativeTime> leaves once a minute and nothing else.
 * - The server snapshot is 0: during hydration every relative part renders
 *   its fallback (nothing), exactly like the server HTML, then fills in.
 *   No hydration mismatch, and no suppressHydrationWarning.
 */
import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const listeners = new Set<() => void>();
let minute = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function current(): number {
  return Math.floor(Date.now() / MINUTE);
}

function emit() {
  const next = current();
  if (next === minute) return;
  minute = next;
  for (const l of listeners) l();
}

function schedule() {
  if (timer !== null || listeners.size === 0) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const wait = MINUTE - (Date.now() % MINUTE) + 50;
  timer = setTimeout(() => {
    timer = null;
    emit();
    schedule();
  }, wait);
}

function stop() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function onVisibility() {
  if (document.visibilityState === "hidden") stop();
  else {
    emit();
    schedule();
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    minute = current();
    document.addEventListener("visibilitychange", onVisibility);
  }
  listeners.add(listener);
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

function getSnapshot(): number {
  // Before the first subscription, read the clock directly.
  return listeners.size > 0 ? minute : current();
}

const getServerSnapshot = () => 0;

/**
 * Milliseconds "now", refreshed once a minute; 0 on the server and during
 * hydration (render no relative text then).
 */
export function useNow(): number {
  const m = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Minute resolution (render stays pure): a time up to a minute ahead of
  // the bucket reads "just now", which is what it is.
  return m * MINUTE;
}

/** Test hook: the number of live subscribers and whether the timer runs. */
export function __tickerState() {
  return { listeners: listeners.size, running: timer !== null };
}
