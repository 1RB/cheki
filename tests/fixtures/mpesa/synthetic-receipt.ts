/**
 * SYNTHETIC M-Pesa Ethiopia receipt PDF, for tests only.
 *
 * This is NOT a real receipt and was NOT copied from one. No real M-Pesa
 * receipt has been observed by cheki (the endpoint is geo-blocked from cloud
 * egress). The layout follows what other open-source verifiers parse out of
 * the PDF that m-pesabusiness.safaricom.et/api/receipt/getReceipt returns
 * base64-encoded in `base64Data`:
 *
 *   - nahom-d54/tx-verify src/providers/mpesa.ts (pdf.js layout mode): a
 *     "RECEIPT NO / PAYMENT DATE / SETTLED AMOUNT" header row followed by a
 *     value row, then one "LABEL   value" row per field (SENDER NAME,
 *     SENDER NUMBER, RECEIVER NAME, RECEIVER ACCOUNT NUMBER, TRANSACTION ID,
 *     SERVICE FEE, DISCOUNT, + 15% VAT, TOTAL, TOTAL AMOUNT IN WORDS, PAYMENT
 *     METHOD, TRANSACTION TYPE, PAYMENT CHANNEL, PAYMENT REASON), section
 *     titles TRANSACTION INFORMATION / TRANSACTION DETAIL / SCAN TO VERIFY,
 *     and lines starting "Safaricom" and "THANK YOU".
 *   - Vixen878/verifier-api src/services/verifyMpesa.ts: the older PAYER NAME /
 *     PAYER PHONE NUMBER / RECEIVER NUMBER labels (covered by text-level tests).
 *
 * The real receipt is bilingual: each English label sits next to an Amharic
 * one, separated by "/". The base-14 PDF fonts used here cannot draw Ethiopic,
 * so the fixture keeps the "/" and leaves the Amharic out; the text-level tests
 * feed Amharic labels to the parser directly.
 *
 * Every name, number and id below is invented. The committed
 * synthetic-receipt.pdf is buildSyntheticMpesaPdf() with no overrides, and a
 * test checks that the two stay identical.
 */

export interface SyntheticMpesaOptions {
  transactionId?: string;
  receiptNo?: string;
  paymentDate?: string;
  settledAmount?: string;
  total?: string;
  senderName?: string;
  senderNumber?: string;
  receiverName?: string;
  receiverAccount?: string;
  /** Adds a "TRANSACTION STATUS" row. No source shows one; used to test the status gate. */
  status?: string;
}

export const SYNTHETIC_MPESA = {
  transactionId: "UCK0SYNTH1",
  receiptNo: "UCK0SYNTH1",
  paymentDate: "2026-09-14 10:21:33",
  settledAmount: "1500.00",
  total: "1,500.00",
  senderName: "SYNTHETIC TEST PAYER",
  senderNumber: "251700000001",
  receiverName: "SYNTHETIC TEST MERCHANT",
  receiverAccount: "251700000002",
} as const;

type Cell = { x: number; y: number; size: number; bold?: boolean; text: string };

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function layout(o: Required<Omit<SyntheticMpesaOptions, "status">> & { status?: string }): Cell[] {
  const cells: Cell[] = [];
  let y = 800;
  const row = (label: string, value: string) => {
    cells.push({ x: 40, y, size: 9, text: `/ ${label}` }, { x: 300, y, size: 9, text: value });
    y -= 20;
  };
  cells.push({ x: 40, y, size: 14, bold: true, text: "Safaricom M-PESA" });
  y -= 18;
  cells.push({ x: 40, y, size: 8, text: "SYNTHETIC TEST FIXTURE - NOT A REAL M-PESA RECEIPT" });
  y -= 30;
  cells.push({ x: 40, y, size: 10, bold: true, text: "TRANSACTION INFORMATION" });
  y -= 22;
  cells.push(
    { x: 40, y, size: 8, text: "RECEIPT NO" },
    { x: 200, y, size: 8, text: "PAYMENT DATE" },
    { x: 400, y, size: 8, text: "SETTLED AMOUNT" }
  );
  y -= 14;
  cells.push(
    { x: 40, y, size: 10, text: o.receiptNo },
    { x: 200, y, size: 10, text: o.paymentDate },
    { x: 400, y, size: 10, text: o.settledAmount }
  );
  y -= 30;
  cells.push({ x: 40, y, size: 10, bold: true, text: "TRANSACTION DETAIL" });
  y -= 22;
  row("SENDER NAME", o.senderName);
  row("SENDER NUMBER", o.senderNumber);
  row("RECEIVER NAME", o.receiverName);
  row("RECEIVER ACCOUNT NUMBER", o.receiverAccount);
  row("TRANSACTION ID", o.transactionId);
  row("TRANSACTION TYPE", "Pay Merchant");
  row("PAYMENT METHOD", "M-PESA");
  row("PAYMENT CHANNEL", "APP");
  row("PAYMENT REASON", "Synthetic fixture");
  if (o.status !== undefined) row("TRANSACTION STATUS", o.status);
  row("SERVICE FEE", "0.00 Birr");
  row("DISCOUNT", "0.00");
  row("+ 15% VAT", "0.00 Birr");
  row("TOTAL", `${o.total} Birr`);
  row("TOTAL AMOUNT IN WORDS", "One Thousand Five Hundred Birr");
  y -= 10;
  cells.push({ x: 40, y, size: 9, bold: true, text: "SCAN TO VERIFY" });
  y -= 30;
  cells.push({ x: 40, y, size: 9, text: "THANK YOU FOR USING M-PESA" });
  return cells;
}

/** Build the synthetic receipt as PDF bytes (deterministic: same options, same bytes). */
export function buildSyntheticMpesaPdf(options: SyntheticMpesaOptions = {}): Buffer {
  const o = { ...SYNTHETIC_MPESA, ...options };
  const content = layout(o)
    .map((c) => `BT /${c.bold ? "F2" : "F1"} ${c.size} Tf ${c.x} ${c.y} Td (${escapePdfString(c.text)}) Tj ET`)
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Title (SYNTHETIC M-Pesa receipt - test fixture, not real) /Producer (cheki tests) >>",
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** The getReceipt JSON envelope other verifiers read: {responseCode, responseDescription, base64Data}. */
export function syntheticMpesaEnvelope(options: SyntheticMpesaOptions = {}, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    responseCode: "0",
    responseDescription: "Success",
    base64Data: buildSyntheticMpesaPdf(options).toString("base64"),
    ...overrides,
  });
}
