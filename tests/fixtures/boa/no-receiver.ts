/**
 * SYNTHETIC Bank of Abyssinia online-slip responses, for tests only.
 *
 * Not copied from a real receipt: every name, phone number, account, amount
 * and reference below is made up. Only the shape (field names, value formats,
 * the { header, body: [row] } envelope) follows what
 * cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id= returned for a real
 * fee receipt on 2026-10-12.
 *
 * A fee or charge receipt ("Account Transfer MB Maintenance") has no
 * Receiver's Name and no Receiver's Account. It does carry the service
 * charge, the VAT on it, the total including VAT, a Payment Reference and a
 * Narrative. As on the real receipt, the VAT is 15% of the Transferred
 * Amount (not of the Service Charge) and the total is the sum of all three.
 * BOA files it under the SOURCE account, so the slip link's
 * 5-digit suffix (12345 here) matches the source account, not a receiver.
 */

/** Made-up FT reference: "FT" + 10 letters/digits. */
export const SYNTH_BOA_REF = "FT26999ABCD1";
/** Made-up 5-digit account suffix (the source account's last 5 digits). */
export const SYNTH_BOA_SUFFIX = "12345";
/** The slip link a BOA customer would share for this receipt. */
export const SYNTH_BOA_SLIP_LINK = `https://cs.bankofabyssinia.com/slip/?trx=${SYNTH_BOA_REF}${SYNTH_BOA_SUFFIX}`;

export const SYNTH_BOA_NO_RECEIVER_ROW = {
  "Source Account Name": "TEST PAYER ONE",
  "VAT (15%)": "15.00",
  "Transferred Amount in word": "One Hundred Birr and Zero Cents",
  Address: "Test Street, Testville",
  "Transaction Type": "Account Transfer MB Maintenance",
  "Service Charge": "5.00",
  "Source Account": "1******45",
  "Payment Reference": "Test fee note",
  "Tel.": "+251900000000",
  "Payer's Name": "TEST PAYER ONE",
  Narrative: "Testing",
  "Transferred Amount": "100.00",
  currency: "ETB",
  "Transaction Reference": SYNTH_BOA_REF,
  "Transaction Date": "01/01/26 09:30",
  "Total Amount including VAT": "120.00",
} as const;

export const SYNTH_BOA_NO_RECEIVER_JSON = JSON.stringify({
  header: { status: "success", total_size: 1 },
  body: [SYNTH_BOA_NO_RECEIVER_ROW],
});
