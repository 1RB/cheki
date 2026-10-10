import type { HealthStatus } from "@/lib/health";

const STYLES: Record<HealthStatus, { label: string; bg: string; fg: string; border: string }> = {
  live: { label: "Live", bg: "var(--green-light)", fg: "var(--green-dark)", border: "transparent" },
  "in-development": { label: "In development", bg: "var(--surface-alt)", fg: "var(--ink-2)", border: "var(--border)" },
  degraded: { label: "Degraded", bg: "var(--amber-light)", fg: "var(--amber-text)", border: "transparent" },
  "not-checked": { label: "Not checked from CI", bg: "var(--surface-alt)", fg: "var(--ink-3)", border: "var(--border)" },
};

export function statusLabel(s: HealthStatus): string {
  return STYLES[s].label;
}

export function StatusPill({ status }: { status: HealthStatus }) {
  const s = STYLES[status];
  return (
    <span
      style={{
        display: "inline-block", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px",
        background: s.bg, color: s.fg, border: `1px solid ${s.border}`, whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
