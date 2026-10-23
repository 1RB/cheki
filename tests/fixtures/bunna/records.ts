/**
 * SYNTHETIC Bunna Bank receipt data, for tests only.
 *
 * Not copied from a real receipt: every name, account number, reference,
 * token, amount and date below is made up. Only the shape (the JSON envelope,
 * field names, Bunna's own account mask, the date-only tranDate, the 0.0 fee
 * fields) follows what online.bunnabanksc.com/st_backend/api/v1/advice
 * returned for a real receipt on 2026-10-23.
 */

/** Made-up 32-byte token, standard base64 with "+", "/" and padding. */
export const SYNTH_BUNNA_TOKEN = "Te+st/Tok3nForCheki+Only/NotReal0000000000Q=";
/** The receipt link a Bunna customer would share (token URL-encoded, slashes left as is). */
export const SYNTH_BUNNA_LINK = "https://online.bunnabanksc.com/receipt/#/Te%2Bst/Tok3nForCheki%2BOnly/NotReal0000000000Q%3D";
/** The canonical receipt page cheki links to (token fully URL-encoded). */
export const SYNTH_BUNNA_PAGE = `https://online.bunnabanksc.com/receipt/#/${encodeURIComponent(SYNTH_BUNNA_TOKEN)}`;
/** What the receipt page's QR encodes (site root, receipt-v2 route). */
export const SYNTH_BUNNA_QR = `https://online.bunnabanksc.com/#/receipt-v2/${encodeURIComponent(SYNTH_BUNNA_TOKEN)}`;
/** The JSON URL cheki fetches for it. */
export const SYNTH_BUNNA_API = `https://online.bunnabanksc.com/st_backend/api/v1/advice?data=${encodeURIComponent(SYNTH_BUNNA_TOKEN)}`;

/** A transfer to a wallet, the shape seen on the real receipt. */
export const SYNTH_BUNNA_RECEIPT = {
  drAccountName: "TEST PAYER ONE",
  drAccount: "1000*****0001",
  crAccountName: "Telebirr",
  crAccount: "9000*****0002",
  currency: "ETB",
  tranType: null,
  typeOfService: null,
  serviceCharge: 0.0,
  totalAmount: 0.0,
  vat: 0.0,
  disasterAmount: 0.0,
  netAmount: 0.0,
  tranId: "BB00001",
  tranDate: "2026-10-01 00:00:00",
  amount: 1250.0,
};

export const SYNTH_BUNNA_SUCCESS = { status: "SUCCESS", receipt: SYNTH_BUNNA_RECEIPT };
export const SYNTH_BUNNA_FAILURE = { status: "FAILURE", message: "Something went wrong!" };

export const json = (v: unknown): string => JSON.stringify(v);
