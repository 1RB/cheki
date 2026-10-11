import { NextRequest, NextResponse } from "next/server";
import { checkAccountSuffix, checkReference } from "@/lib/security/reference";
import { safeFetch, MAX_PDF_BYTES } from "@/lib/http/safe-fetch";
import { limiters, rateLimited } from "@/lib/rate-limit";
import { getBank } from "@/lib/manifest/loader";
import { fillTemplate, formatAccountDigits, formatNeeds, selectFormat, templateHost } from "@/lib/manifest/formats";
import { getParser } from "@/lib/parsers/registry";
import "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open the bank's own copy of a receipt.
 *
 * Kept because the SDKs build links to it (getReceiptUrl / get_receipt_url /
 * GetReceiptURL) and /docs documents it. How each format is served comes from
 * its `receiptPage` in banks.json, and the format is picked from the
 * reference's shape, current first (no extra bank request):
 *
 *   - "redirect" (CBE Receipt ID, Dashen FT Ref): a 302 to the bank's own
 *     receipt page. These banks answer with HTML. Proxying bank HTML from
 *     cheki's origin would run the bank's markup and scripts as cheki (stored
 *     XSS if the page ever reflects input); a sandbox CSP or an attachment
 *     download would make it inert but useless (no styles, a .html file to
 *     open). A redirect shows the real page on the bank's origin, costs cheki
 *     no bank request, and is not an open redirect: the URL is the manifest
 *     template on a fixed host, filled with a validated reference.
 *   - "pdf" (CBE FT reference + account, Zemen): fetched from an allowlisted
 *     host and returned only if the body really is a PDF, as
 *     application/pdf, as an attachment, with nosniff and a sandbox CSP.
 *     Anything else (an HTML error page) is a 502, never served.
 *
 * Banks are looked up in a Map built from the manifest, so "constructor" or
 * "__proto__" are not banks.
 */
const RECEIPT_BANKS = new Map(
  ["cbe", "zemen", "dashen"].map((id) => [id, getBank(id)] as const).filter(([, b]) => b?.formats?.some((f) => f.receiptPage))
);

const fail = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const limited = rateLimited(limiters.verify, request.headers);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const bankParam = params.get("bank");
  const reference = params.get("reference");
  const accountNumber = params.get("account") ?? undefined;

  if (!bankParam || !reference) {
    return fail("bank and reference are required.", 400);
  }

  const bank = RECEIPT_BANKS.get(bankParam.toLowerCase());
  if (!bank) {
    return fail(`Receipt download is only supported for: ${Array.from(RECEIPT_BANKS.keys()).join(", ")}.`, 400);
  }

  const ref = checkReference(reference);
  if (!ref.ok) return fail(ref.message, 400);

  const selection = selectFormat(bank, { reference: ref.value, accountNumber });
  if (!selection.ok) return fail(selection.message, 400);
  const format = selection.format;
  if (!format?.receiptPage) {
    return fail("This receipt format can't be opened through cheki. Verify it with POST /api/verify instead.", 400);
  }

  let account: string | undefined;
  if (formatNeeds(format, "account")) {
    const digits = formatAccountDigits(format) ?? 1;
    const acct = checkAccountSuffix(accountNumber ?? "", digits);
    if (!acct.ok) return fail(acct.message, 400);
    account = acct.value;
  }

  if (format.receiptPage === "redirect") {
    const target = format.link ? fillTemplate(format.link, { ref: ref.value, account }) : "";
    // Only the template's own host, over https, with nothing left unfilled.
    let targetUrl: URL | null = null;
    try {
      targetUrl = target ? new URL(target) : null;
    } catch {
      targetUrl = null;
    }
    const expectedHost = templateHost(format.link);
    if (!targetUrl || !expectedHost || targetUrl.protocol !== "https:" || /\{[^}]*\}/.test(target) || targetUrl.host.toLowerCase() !== expectedHost) {
      return fail("Receipt link unavailable.", 502);
    }
    return new NextResponse(null, {
      status: 302,
      headers: { Location: targetUrl.href, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  const parser = format.parser ? getParser(format.parser) : undefined;
  if (!parser) return fail("Receipt download is not available for this format.", 400);

  try {
    const resp = await safeFetch(parser.buildUrl(ref.value, account), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cheki)" },
      timeoutMs: 15000,
      maxBytes: MAX_PDF_BYTES,
    });

    if (resp.status !== 200) {
      const notFound = resp.status === 404;
      return fail(notFound ? "Receipt not found." : `Bank returned status ${resp.status}.`, notFound ? 404 : 502);
    }

    if (!resp.body.subarray(0, 5).toString("ascii").startsWith("%PDF")) {
      return fail("The bank did not return a PDF receipt.", 502);
    }
    return new NextResponse(new Uint8Array(resp.body), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${bank.id}-receipt.pdf"`,
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail("Failed to download receipt.", 502);
  }
}
