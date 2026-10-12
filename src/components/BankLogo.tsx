// Bank logo marks: a rounded square in the bank's colour with its initials.
// The marks are described once in BANK_LOGOS (src/lib/bank-logos.ts), so the
// Open Graph cards (src/lib/og) draw the same mark the checker shows.
import { bankLogoSpec, type BankLogoSpec } from "@/lib/bank-logos";

function LogoMark({ size, spec }: { size: number; spec: BankLogoSpec }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="8" fill={spec.color} />
      <text
        x="20" y="20"
        dominantBaseline="central" textAnchor="middle"
        fill="#fff" fontSize={spec.fontSize} fontWeight={spec.fontWeight}
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing={spec.letterSpacing}
      >
        {spec.label}
      </text>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  shortName: string;
  color: string;
}

/** A generic mark: the first three letters of `shortName` on `color`. */
export function BankLogo({ size = 36, shortName, color }: LogoProps) {
  return (
    <LogoMark
      size={size}
      spec={{ label: shortName.slice(0, 3).toUpperCase(), color, fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em" }}
    />
  );
}

export function BankLogoByName({ code, size = 36 }: { code: string; size?: number }) {
  return <LogoMark size={size} spec={bankLogoSpec(code)} />;
}
