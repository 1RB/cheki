import { NextResponse } from "next/server";
import { getAllBanks } from "@/lib";
import { formatAccountDigits, isCheckableFormat } from "@/lib/manifest/formats";

export const runtime = "nodejs";

/**
 * Banks and their receipt formats. `formats` is ordered current first, so a
 * client can lead with the first supported format and offer the rest as
 * "older receipt" options. requiresAccount / accountDigits / endpoint describe the bank's
 * primary (current) format; a legacy format that needs an account says so in
 * its own `inputs` and `accountDigits`. `beta: true` (only present when set)
 * marks a live bank whose parser has not yet been confirmed with a real
 * receipt (M-Pesa).
 */
export async function GET() {
  const banks = getAllBanks().map((b) => ({
    id: b.id,
    name: b.name,
    // The public contract keeps `swift` as the plain BIC string; sources and
    // the check date stay in the manifest and on the bank page.
    swift: b.swift?.bic,
    type: b.type,
    status: b.status,
    ...(b.beta ? { beta: true } : {}),
    requiresAccount: b.requiresAccount,
    accountDigits: b.accountDigits,
    requiresPhone: b.requiresPhone,
    endpoint: b.endpoint,
    color: b.color,
    initials: b.initials,
    formats: (b.formats ?? []).map((f) => ({
      id: f.id,
      status: f.status,
      label: f.label,
      inputs: f.inputs.map((i) => i.name),
      accountDigits: formatAccountDigits(f),
      responseType: f.responseType,
      supported: isCheckableFormat(b, f),
      confidence: f.confidence,
    })),
  }));

  return NextResponse.json({ banks });
}
