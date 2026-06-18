// Bank logo SVGs - clean, professional vector logos using brand colors
// Each logo is a rounded square with the bank's initials in a professional style

interface LogoProps {
  size?: number;
  shortName: string;
  color: string;
}

export function BankLogo({ size = 36, shortName, color }: LogoProps) {
  const initials = shortName.slice(0, 3).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill={color} />
      <text
        x="20" y="20"
        dominantBaseline="central" textAnchor="middle"
        fill="#fff" fontSize="13" fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="-0.02em"
      >
        {initials}
      </text>
    </svg>
  );
}

// CBE - green with "CBE"
export function CBEOCogo({ size = 36 }: { size?: number }) {
  return <BankLogo size={size} shortName="CBE" color="#1a5c3e" />;
}

// Telebirr - orange with "Tb"
export function TelebirrLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#e8a000" />
      <text x="20" y="20" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800" fontFamily="Inter, system-ui, sans-serif">Tb</text>
    </svg>
  );
}

// BOA - purple
export function BOALogo({ size = 36 }: { size?: number }) {
  return <BankLogo size={size} shortName="BOA" color="#7c3aed" />;
}

// M-Pesa - green (Safaricom green)
export function MPesaLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#16a34a" />
      <text x="20" y="20" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">M-P</text>
    </svg>
  );
}

// Dashen - red
export function DashenLogo({ size = 36 }: { size?: number }) {
  return <BankLogo size={size} shortName="DAS" color="#dc2626" />;
}

// Awash - amber
export function AwashLogo({ size = 36 }: { size?: number }) {
  return <BankLogo size={size} shortName="AWA" color="#f59e0b" />;
}

// Zemen - blue
export function ZemenLogo({ size = 36 }: { size?: number }) {
  return <BankLogo size={size} shortName="ZEM" color="#2563eb" />;
}

// CBE Birr - sky blue
export function CBEBirrLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#0ea5e9" />
      <text x="20" y="20" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">CBEb</text>
    </svg>
  );
}

// Siinqee - pink
export function SiinqeeLogo({ size = 36 }: { size?: number }) {
  return <BankLogo size={size} shortName="SQE" color="#be185d" />;
}

const logoMap: Record<string, (props: { size?: number }) => React.ReactElement> = {
  cbe: CBEOCogo,
  telebirr: TelebirrLogo,
  boa: BOALogo,
  mpesa: MPesaLogo,
  dashen: DashenLogo,
  awash: AwashLogo,
  zemen: ZemenLogo,
  cbebirr: CBEBirrLogo,
  siinqee: SiinqeeLogo,
};

export function BankLogoByName({ code, size = 36 }: { code: string; size?: number }) {
  const Logo = logoMap[code];
  if (Logo) return <Logo size={size} />;
  return <BankLogo size={size} shortName={code.slice(0, 3).toUpperCase()} color="#666" />;
}
