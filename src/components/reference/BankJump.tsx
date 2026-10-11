"use client";

/**
 * The bank switcher on small screens: a native select (the platform picker
 * is the best list UI on a phone). Choosing a bank jumps to its #anchor, so
 * deep links and the back button keep working.
 */
export function BankJump({ groups }: { groups: { label: string; banks: { id: string; label: string; state: string }[] }[] }) {
  return (
    <div className="ep-jump">
      <label htmlFor="ep-jump-select">Jump to a bank</label>
      <select
        id="ep-jump-select"
        defaultValue=""
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          const el = document.getElementById(id);
          history.pushState(null, "", `#${id}`);
          el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          el?.querySelector<HTMLElement>("h2 a, h3")?.focus({ preventScroll: true });
        }}
      >
        <option value="" disabled>Choose a bank</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.banks.map((b) => (
              <option key={b.id} value={b.id}>{`${b.label} · ${b.state}`}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
