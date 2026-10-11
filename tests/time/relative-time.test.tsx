// @vitest-environment jsdom
/**
 * <RelativeTime>: a <time datetime> with the full timestamp in its title, the
 * absolute part server-safe, the relative part client-only from one shared
 * minute clock that pauses while the tab is hidden.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { RelativeTime } from "@/components/RelativeTime";
import { __tickerState } from "@/lib/time/use-now";

const T0 = Date.parse("2026-10-11T11:32:00Z"); // 14:32 in Addis Ababa

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RelativeTime", () => {
  it("server HTML has the date only: no relative text to mismatch on hydration", () => {
    const html = renderToString(<RelativeTime value="2026-10-11T14:32:00+03:00" />);
    expect(html).toMatch(/datetime="2026-10-11T11:32:00\.000Z"/i);
    expect(html).toContain("11 Oct 2026, 14:32");
    expect(html).not.toContain("ago");
    expect(html).toMatch(/title="[^"]*Addis Ababa time\)"/);
  });

  it("uses a precomputed absolute string from a server component verbatim", () => {
    const html = renderToString(<RelativeTime value="2026-10-11T11:32:00Z" absolute="SERVER TEXT" />);
    expect(html).toContain("SERVER TEXT");
  });

  it("adds the relative part on the client and updates it once a minute", () => {
    vi.useFakeTimers({ now: T0 + 3 * 60 * 60_000 });
    const { container } = render(<RelativeTime value="2026-10-11T14:32:00+03:00" />);
    expect(container.textContent).toBe("11 Oct 2026, 14:32 · 3 hours ago");
    // The shared timer fires 50 ms after each minute boundary.
    act(() => { vi.advanceTimersByTime(60 * 60_000 + 100); });
    expect(container.textContent).toBe("11 Oct 2026, 14:32 · 4 hours ago");
  });

  it("relative variant with a template: Checked just now, then 2 minutes ago", () => {
    vi.useFakeTimers({ now: T0 + 5_000 });
    const { container } = render(<RelativeTime value={new Date(T0)} variant="relative" template="time.checked" />);
    expect(container.textContent).toBe("Checked just now");
    act(() => { vi.advanceTimersByTime(2 * 60_000 + 100); });
    expect(container.textContent).toBe("Checked 2 minutes ago");
  });

  it("all instances share one timer, stopped when the last unmounts", () => {
    vi.useFakeTimers({ now: T0 });
    const a = render(<RelativeTime value={T0} />);
    const b = render(<><RelativeTime value={T0} /><RelativeTime value={T0} variant="relative" /></>);
    expect(__tickerState()).toEqual({ listeners: 3, running: true });
    a.unmount();
    b.unmount();
    expect(__tickerState()).toEqual({ listeners: 0, running: false });
  });

  it("pauses while the tab is hidden and catches up on return", () => {
    vi.useFakeTimers({ now: T0 });
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const { container } = render(<RelativeTime value={T0} variant="relative" />);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(__tickerState().running).toBe(false);
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(container.textContent).toBe("just now"); // no timer ran while hidden
    vis.mockReturnValue("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(container.textContent).toBe("10 minutes ago");
    expect(__tickerState().running).toBe(true);
    vis.mockRestore();
  });

  it("past 30 days the date stands alone; a bank's own odd text is shown as written", () => {
    vi.useFakeTimers({ now: T0 + 40 * 24 * 60 * 60_000 });
    const { container, rerender } = render(<RelativeTime value={T0} />);
    expect(container.textContent).toBe("11 Oct 2026, 14:32");
    rerender(<RelativeTime value="Meskerem 30" />);
    expect(container.textContent).toBe("Meskerem 30");
    expect(container.querySelector("time")).toBeNull();
  });
});
