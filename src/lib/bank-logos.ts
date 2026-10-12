/**
 * Bank logo marks, described once: the checker draws them as SVG
 * (src/components/BankLogo.tsx) and the Open Graph cards draw them with
 * ImageResponse (src/lib/og), which cannot render SVG <text>.
 *
 * A mark is a 40x40 rounded square (rx 8) in `color` with `label` centred in
 * white Inter. Sizes are in the 40-unit box.
 */
export interface BankLogoSpec {
  label: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: string;
}

const initials = (label: string, color: string): BankLogoSpec => ({
  label,
  color,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "-0.02em",
});

export const BANK_LOGOS: Record<string, BankLogoSpec> = {
  cbe: initials("CBE", "#1a5c3e"),
  telebirr: { label: "Tb", color: "#e8a000", fontSize: 14, fontWeight: 800 },
  boa: initials("BOA", "#7c3aed"),
  mpesa: { label: "M-P", color: "#16a34a", fontSize: 11, fontWeight: 700 },
  dashen: initials("DAS", "#dc2626"),
  awash: initials("AWA", "#f59e0b"),
  zemen: initials("ZEM", "#2563eb"),
  cbebirr: { label: "CBEb", color: "#0ea5e9", fontSize: 10, fontWeight: 700 },
  siinqee: initials("SQE", "#be185d"),
  zamzam: initials("ZZB", "#0d9488"),
};

/** The mark for a bank code; unknown codes get their first three letters on grey. */
export function bankLogoSpec(code: string): BankLogoSpec {
  return BANK_LOGOS[code] ?? initials(code.slice(0, 3).toUpperCase(), "#666");
}
