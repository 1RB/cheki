/**
 * SYNTHETIC ZamZam Bank receipt records, for tests only.
 *
 * Not copied from a real receipt: every name, account number, reference, id,
 * amount and date below is made up. Only the shape (field names, value
 * formats, the literal "NULL" strings, the date-only `dt`) follows what
 * receipt-backend.zamzambank.com.et/api/v1/invoice/{id} returned for a real
 * receipt on 2026-10-12. An unknown id answers HTTP 200 with the body `null`.
 */

/** Made-up receipt id (the number at the end of the receipt link). */
export const SYNTH_ZAMZAM_ID = "12345678";
/** The receipt link a ZamZam customer would share for it. */
export const SYNTH_ZAMZAM_LINK = `https://receipt.zamzambank.com.et/receipt/${SYNTH_ZAMZAM_ID}`;
/** Made-up full account number, as ZamZam returns it (unmasked). */
export const SYNTH_ZAMZAM_ACCOUNT = "0012345670101";
/** How cheki must show it: first digit and last 4. */
export const SYNTH_ZAMZAM_ACCOUNT_MASKED = "0********0101";

/** A debit (the account holder paid): Telebirr outgoing transfer, no counterparty name. */
export const SYNTH_ZAMZAM_DEBIT = {
  name: "TEST HOLDER ONE",
  reference: "000TEST00000001",
  id: 12345678,
  amount: "50",
  vat: "0.75",
  dt: "2026-08-26 00:00:00",
  acc_NUM: SYNTH_ZAMZAM_ACCOUNT,
  drcr: "D",
  other_NAME: "NULL",
  trn_DESCRIPTION: "TELE BIRR OUT GOING",
  deposited_BY: null,
  currency: "ETB",
  code: "TBO",
  check: null,
  parameter: "NULL",
};

/** A credit (the account holder received) with the other side named. */
export const SYNTH_ZAMZAM_CREDIT = {
  ...SYNTH_ZAMZAM_DEBIT,
  id: 12345679,
  reference: "000TEST00000002",
  amount: "1,250.50",
  drcr: "C",
  other_NAME: "TEST SENDER TWO",
  trn_DESCRIPTION: "FUNDS TRANSFER",
  code: "FT1",
};

/** A charge record (code CH1 / "CHARGES"). */
export const SYNTH_ZAMZAM_CHARGE = {
  ...SYNTH_ZAMZAM_DEBIT,
  id: 12345680,
  reference: "000TEST00000003",
  amount: "5",
  vat: "0.75",
  trn_DESCRIPTION: "CHARGES",
  code: "CH1",
};

export const json = (v: unknown): string => JSON.stringify(v);
