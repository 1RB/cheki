/**
 * SYNTHETIC CBE Birr receipt PDF, for tests only.
 *
 * This is NOT a real receipt. It copies the LAYOUT of the PDF that
 * cbepay1.cbe.com.et/aureceipt returned for two real receipts on 2026-10-16
 * (labels, row order, column positions, and the content-stream order in which
 * the real PDF draws its text), but every name, phone number, account,
 * amount, id and date below is invented. The names and amount match the
 * shared synthetic sample (ABEBE KEBEDE pays TIGIST ALEMU 1,250.50 ETB) and
 * the receipt number is the documented example DTS41AB2C90.
 *
 * Layout notes, from the real receipts:
 *   - "Transaction Information" rows are "Label <value>" with the value at
 *     x=406; Debit Account is "<payer phone> - <PAYER NAME>", Credit Account
 *     is "<wallet phone> - <NAME>" or "<masked bank account> - <BANK>".
 *     Long names wrap onto a second row.
 *   - The real PDF draws the four money values before their labels, and the
 *     words/reason/channel labels before their values, and Tip and Disaster
 *     Response Fee last. Flowed text extraction therefore scrambles them;
 *     cheki's row extractor groups text by position instead.
 *   - Base-14 fonts only (no embedded fonts), so the bytes are tiny and
 *     deterministic. The real PDF embeds fonts and is about 0.5 MB.
 *
 * The committed synthetic-receipt.pdf is buildSyntheticCbeBirrPdf() with no
 * options, and a test checks that the two stay identical.
 */

export interface SyntheticCbeBirrOptions {
  receiptNumber?: string;
  orderId?: string;
  date?: string;
  amount?: string;
  serviceCharge?: string;
  vat?: string;
  total?: string;
  payerPhone?: string;
  payerName?: string;
  /** The Credit Account row. A second string wraps onto the next row. */
  credit?: string[];
  /** The Receiver Name row. A second string wraps onto the next row. */
  receiver?: string[];
  status?: string;
  /** The payer's optional note, printed before the ":" on the Reference row. */
  note?: string;
  amountInWords?: string;
  reason?: string;
  channel?: string;
}

/** A wallet-to-wallet "Send Money" receipt. */
export const SYNTHETIC_CBEBIRR = {
  receiptNumber: "DTS41AB2C90",
  orderId: "DTS41AB2C90",
  date: "2026-10-01 09:15",
  amount: "1250.50",
  serviceCharge: "0.00",
  vat: "0.00",
  total: "1250.50",
  payerPhone: "0911004321",
  payerName: "ABEBE KEBEDE",
  credit: ["0922006171 - TIGIST ALEMU"],
  receiver: ["0922006171 - TIGIST ALEMU"],
  status: "Completed",
  note: "",
  amountInWords: "One Thousand Two Hundred Fifty ETB and Fifty Cents .",
  reason: "Send Money",
  channel: "API",
} as const;

/** The same payment as a wallet-to-bank transfer: masked bank account, receiver name without a phone. */
export const SYNTHETIC_CBEBIRR_TO_BANK: SyntheticCbeBirrOptions = {
  orderId: "FT26SAMPLE01",
  credit: ["1000****6171 - CBE"],
  receiver: ["Ms Tigist Alemu"],
  note: "Invoice 42",
  reason: "TransferfromMMToBank by Customer to Org",
};

type Cell = { x: number; y: number; size: number; bold?: boolean; text: string };

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function layout(o: Required<SyntheticCbeBirrOptions>): Cell[] {
  const c: Cell[] = [];
  const t = (x: number, y: number, text: string, size = 8, bold = false) => c.push({ x, y, size, bold, text });

  t(32, 760, "Commercial Bank of Ethiopia", 14, true);
  t(32, 742, "VAT Invoice/ Customer Receipt", 10);
  t(32, 728, "CBEBirr", 10, true);
  t(32, 714, "SYNTHETIC TEST FIXTURE - NOT A REAL CBE BIRR RECEIPT", 7);
  t(32, 703, "Company Address & Other Information", 9, true);
  t(327, 703, "Customer Information", 9, true);
  // Company block (left) and customer labels (right), as the real PDF draws them.
  t(32, 689, "Country: Ethiopia");
  t(32, 674, "City: Addis Ababa");
  t(32, 660, "Address: Example St, 01, Kirkos");
  t(32, 645, "Postal code: 000");
  t(32, 631, "SWIFT Code: CBETETAA");
  t(327, 689, "Customer Name:");
  t(327, 674, "Region:");
  t(327, 660, "City:");
  t(327, 645, "Sub city:");
  t(435, 689, o.payerName);
  t(327, 631, "Wereda/kebele:");
  t(327, 617, "VAT Registration No:");
  t(32, 559, "VAT Invoice No:");
  t(32, 545, "VAT Registration No:000000");
  t(32, 530, "VAT Registration Date: 01/01/2000");

  t(251, 507, "Transaction Information", 10, true);
  const row = (y: number, label: string, value: string[]) => {
    t(32, y, label);
    value.forEach((v, i) => t(406, y - i * 11, v));
  };
  row(473, "Debit Account", [`${o.payerPhone} - ${o.payerName}`]);
  row(458, "Credit Account", o.credit);
  row(435, "Receiver Name", o.receiver);
  row(405, "Order ID", [o.orderId]);
  row(391, "Transaction Status", [o.status]);
  t(32, 376, "Reference");
  t(406, 376, o.note ? `${o.note} :` : ":");

  t(255, 348, "Transaction Details", 10, true);
  t(24, 320, "Receipt Number");
  t(274, 320, "Transaction Date");
  t(491, 320, "Amount");
  const [day, time] = o.date.split(" ");
  t(39, 293, o.receiptNumber);
  t(284, 293, day);
  t(337, 293, time);
  t(507, 293, o.amount);
  // Money values first, then their labels (the real content-stream order).
  t(500, 271, o.amount);
  t(500, 257, o.serviceCharge);
  t(500, 213, o.vat);
  t(500, 185, o.total);
  t(406, 271, "Paid amount");
  t(406, 257, "Service Charge");
  t(406, 213, "VAT");
  t(406, 185, "Total Paid Amount");
  // Labels first, then the values.
  t(32, 170, "Total Amount in word");
  t(32, 156, "Payment Reason");
  t(32, 141, "Payment Channel");
  t(183, 170, o.amountInWords);
  t(183, 156, o.reason);
  t(183, 141, o.channel);
  t(144, 111, "The Bank you can always rely on!", 9);
  t(124, 92, "(c) 2026 Commercial Bank of Ethiopia. All rights reserved", 7);
  // Drawn last in the real PDF.
  t(327, 573, "Branch:");
  t(500, 199, "0.00");
  t(406, 199, "Tip");
  t(500, 240, "0.00");
  t(406, 242, "Disaster Response");
  t(406, 231, "Fee");
  return c;
}

/** Build the synthetic receipt as PDF bytes (deterministic: same options, same bytes). */
export function buildSyntheticCbeBirrPdf(options: SyntheticCbeBirrOptions = {}): Buffer {
  const o = { ...SYNTHETIC_CBEBIRR, ...options } as Required<SyntheticCbeBirrOptions>;
  const content = layout(o)
    .map((cell) => `BT /${cell.bold ? "F2" : "F1"} ${cell.size} Tf ${cell.x} ${cell.y} Td (${escapePdfString(cell.text)}) Tj ET`)
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Title (SYNTHETIC CBE Birr receipt - test fixture, not real) /Producer (cheki tests) >>",
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
