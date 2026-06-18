import { NextResponse } from "next/server";
import { getAllBanks } from "@/lib";

export const runtime = "nodejs";

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
  }));

  return NextResponse.json({ banks });
}
