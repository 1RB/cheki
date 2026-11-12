/**
 * SYNTHETIC Wegagen Bank share ids, records and receipt QR text, for tests
 * only.
 *
 * Not copied from a real receipt: every name, account number, share id,
 * reference, amount and date below is made up. Only the shape (the field
 * names of the JSON record, the 24-character share id, the share link and the
 * prose line the receipt page's QR carries) follows what
 * transinfo.wegagenbanksc.com.et:8011/sms_wega/txn/{id} and the share page on
 * :8183 returned for real receipts on 2026-11-11. Never put a real share id
 * here: a real id resolves to a real person's receipt.
 */
import { WEGAGEN_SHARE_URL } from "@/lib/parsers/wegagen";

/** The printed 16-character Reference No (synthetic): 3 digits, 4 letters, 9 more. */
export function synthRef(seed: string): string {
  const s = seed.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(9, "0").slice(0, 9);
  return `000SAMP${s}`;
}

/** The 24-character share id for a seed: its reference plus 8 more characters. */
export function synthId(seed: string): string {
  return `${synthRef(seed)}0001DFTD`;
}

/** The default share id used across the tests. */
export const SYNTH_WEGAGEN_ID = synthId("SAMPLE1");
/** Its printed Reference No: the first 16 characters of the share id. */
export const SYNTH_WEGAGEN_REF = synthRef("SAMPLE1");
/** A second share id with the same prefix but a different account suffix. */
export const SYNTH_WEGAGEN_ID_2 = synthId("SAMPLE2");
/** A share id whose record is someone else's (its prefix never matches). */
export const SYNTH_WEGAGEN_OTHER_ID = "111OTHR26000000000000001";
/** The share link a Wegagen customer would share for the default id. */
export const SYNTH_WEGAGEN_LINK = `${WEGAGEN_SHARE_URL}${SYNTH_WEGAGEN_ID}`;

/** Made-up payer account as the record returns it (13 digits, unmasked). */
export const SYNTH_WEGAGEN_SENDER_ACCOUNT = "1000000000001";
/** How cheki must show it: Wegagen's own rule keeps the first digit and last 7. */
export const SYNTH_WEGAGEN_SENDER_MASKED = "1*****0000001";
/** Made-up payee account of a length Wegagen masks differently (12 characters). */
export const SYNTH_WEGAGEN_RECEIVER_ACCOUNT = "200000000009";
export const SYNTH_WEGAGEN_RECEIVER_MASKED = "2000*****09";

/** What the endpoint answers for a share id it has no record of (41 bytes). */
export const SYNTH_WEGAGEN_NOT_FOUND = "Transaction not found in Daily or History";

/**
 * A full record for `seed` (synthetic). `trnDt` is 21:00 UTC on 2026-07-06,
 * which is 00:00 on 2026-07-07 in Addis Ababa, so the receipt date must cross
 * midnight when the parser shifts it by 3 hours.
 */
export function wegagenRecord(seed: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    trnRefNo: synthRef(seed),
    txnAmount: 1250,
    currency: "ETB",
    trnDt: "2026-07-06T21:00:00.000Z",
    drCr: "D",
    trnCode: "FTD",
    paymentMethod: "Account To Account Transfer",
    sender_name: "TEST PAYER",
    sender_account: SYNTH_WEGAGEN_SENDER_ACCOUNT,
    receiver_name: "TEST RECEIVER",
    receiver_account: SYNTH_WEGAGEN_RECEIVER_ACCOUNT,
    accNo: SYNTH_WEGAGEN_SENDER_ACCOUNT,
    narrative: "Synthetic invoice",
    messageStatus: "0: Accepted for delivery",
    charge: "15.00",
    vat: "0.75",
    srNo: 1,
    module: "SMS",
    phone: "0911000000",
    ...overrides,
  };
}

/** The default record, as JSON exactly as the endpoint sends it. */
export const SYNTH_WEGAGEN_RECORD = wegagenRecord("SAMPLE1");
export const SYNTH_WEGAGEN_BODY = JSON.stringify(SYNTH_WEGAGEN_RECORD);

/** The prose line the receipt page's QR carries, with the share link inside it. */
export const SYNTH_WEGAGEN_QR =
  `Amount ETB-1,250.00 is Transferred From : TEST PAYER and To: TEST RECEIVER For more information, click here: ${SYNTH_WEGAGEN_LINK} - Wegagen Bank.`;
