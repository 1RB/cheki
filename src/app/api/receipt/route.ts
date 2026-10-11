import { NextRequest, NextResponse } from "next/server";
import { checkAccountSuffix, checkReference } from "@/lib/security/reference";
import { safeFetch, MAX_PDF_BYTES } from "@/lib/http/safe-fetch";
import { limiters, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the raw receipt file from the bank.
 *
 * Kept (not deleted) because the SDKs build links to it: receiptUrl() in the
 * TypeScript, Python and PHP clients, and /docs documents it. Hardened:
 *   - The bank is looked up in a Map, so "constructor", "__proto__" and other
 *     Object.prototype names are not banks. A plain object lookup used to turn
 *     ?bank=constructor into an open proxy for any URL.
 *   - The reference and account are validated like /api/verify does.
 *   - Only allowlisted bank hosts are fetched (safeFetch), with a size cap.
 *   - The filename is fixed and the response is private.
 */
type Builder = { build: (ref: string, account?: string) => string; accountDigits?: number };

const BANK_ENDPOINTS = new Map<string, Builder>([
  [
    "cbe",
    {
      accountDigits: 8,
      build: (ref, account) => `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ref)}${account ?? ""}`,
    },
  ],
  ["zemen", { build: (ref) => `https://share.zemenbank.com/rt/${encodeURIComponent(ref)}/pdf` }],
  [
    "dashen",
    { build: (ref) => `https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-${encodeURIComponent(ref)}.pdf` },
  ],
]);

const fail = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const limited = rateLimited(limiters.verify, request.headers);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const bank = params.get("bank");
  const reference = params.get("reference");
  const accountNumber = params.get("account");

  if (!bank || !reference) {
    return fail("bank and reference are required.", 400);
  }

  const builder = BANK_ENDPOINTS.get(bank.toLowerCase());
  if (!builder) {
    return fail(`Receipt download is only supported for: ${Array.from(BANK_ENDPOINTS.keys()).join(", ")}.`, 400);
  }

  const ref = checkReference(reference);
  if (!ref.ok) return fail(ref.message, 400);

  let account: string | undefined;
  if (builder.accountDigits) {
    if (!accountNumber) return fail("account is required for this bank.", 400);
    const acct = checkAccountSuffix(accountNumber, builder.accountDigits);
    if (!acct.ok) return fail(acct.message, 400);
    account = acct.value;
  }

  try {
    const resp = await safeFetch(builder.build(ref.value, account), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cheki)" },
      timeoutMs: 15000,
      maxBytes: MAX_PDF_BYTES,
    });

    if (resp.status !== 200) {
      return fail(`Bank returned status ${resp.status}.`, resp.status === 404 ? 404 : 502);
    }

    const isPdf = resp.body.subarray(0, 5).toString("ascii").startsWith("%PDF");
    return new NextResponse(new Uint8Array(resp.body), {
      status: 200,
      headers: {
        "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `attachment; filename="receipt.${isPdf ? "pdf" : "bin"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail("Failed to download receipt.", 502);
  }
}
