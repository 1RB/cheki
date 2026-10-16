/**
 * The one synthetic receipt every public example uses: /docs, /developers,
 * the guides, README.md, public/llms.txt and the SDK READMEs.
 *
 * Every value is invented. The names, accounts and reference match the
 * verify_verified case in sdks/fixtures/api-contract.json, and
 * tests/content/redaction.test.ts holds the two together, so an example can
 * never drift back to a real receipt. The Receipt ID and the FT reference
 * point at no real transaction, so pasting them into cheki returns "not found".
 *
 * Plain data with no imports, so client pages (/developers) can use it too.
 */
export const SAMPLE = {
  /** CBE Receipt ID, the current format (mbreciept.cbe.com.et/{id}). */
  receiptId: "fHCxExampleRcpt01",
  receiptUrl: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
  /** Older CBE receipts: FT reference plus the receiving account. */
  reference: "FT26SAMPLE01",
  accountNumber: "1000000006171",
  senderName: "ABEBE KEBEDE",
  senderAccount: "1****4321",
  receiverName: "TIGIST ALEMU",
  receiverAccount: "1****6171",
  amount: 1250.5,
  currency: "ETB",
  date: "2026-10-01",
  reason: "Invoice 42",
  durationMs: 1830,
} as const;

/** A verified CBE response, as POST /api/verify returns it for SAMPLE.receiptUrl. */
export const SAMPLE_VERIFY_RESPONSE = {
  success: true,
  verified: true,
  bank: "Commercial Bank of Ethiopia",
  bankCode: "cbe",
  reference: SAMPLE.reference,
  amount: SAMPLE.amount,
  currency: SAMPLE.currency,
  senderName: SAMPLE.senderName,
  senderAccount: SAMPLE.senderAccount,
  receiverName: SAMPLE.receiverName,
  receiverAccount: SAMPLE.receiverAccount,
  date: SAMPLE.date,
  reason: SAMPLE.reason,
  durationMs: SAMPLE.durationMs,
  sourceUrl: SAMPLE.receiptUrl,
} as const;

/** The shorter response the quick starts show. */
export const SAMPLE_QUICKSTART_RESPONSE = {
  success: true,
  verified: true,
  bank: "Commercial Bank of Ethiopia",
  reference: SAMPLE.reference,
  amount: SAMPLE.amount,
  currency: SAMPLE.currency,
  senderName: SAMPLE.senderName,
  receiverName: SAMPLE.receiverName,
  date: SAMPLE.date,
  sourceUrl: SAMPLE.receiptUrl,
} as const;
