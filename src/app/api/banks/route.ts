import { NextResponse } from "next/server";
import { getAllBanks } from "@/lib";
import { formatAccountDigits, isSupportedFormat } from "@/lib/manifest/formats";

export const runtime = "nodejs";

/**
 * Banks and their receipt formats. `formats` is ordered current first, so a
 * client can lead with the first supported format and offer the rest as
 * "older receipt" options. requiresAccount / accountDigits / endpoint describe the bank's
 * primary (current) format; a legacy format that needs an account says so in
 * its own `inputs` and `accountDigits`.
 */
export async function GET() {
  const banks = getAllBanks().map((b) => ({
    id: b.id,
    name: b.name,
    swift: b.swift,
    type: b.type,
    status: b.status,
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
      supported: isSupportedFormat(f),
      confidence: f.confidence,
    })),
  }));

  return NextResponse.json({ banks });
}
