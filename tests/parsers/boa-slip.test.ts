/**
 * BOA slip links (cs.bankofabyssinia.com/slip/?trx={ref}{5 digits}) and
 * receipts without a receiver. All data is synthetic
 * (tests/fixtures/boa/no-receiver.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { detectBankFromUrl, splitBoaSlipId } from "@/lib/adapters/url-detector";
import { BOAParser } from "@/lib/parsers/boa";
import { detectInput, accountFieldKeys } from "@/lib/verify/detect";
import { Verifier } from "@/lib";
import { tEn } from "@/lib/i18n/translate";
import "@/lib/parsers";
import {
  SYNTH_BOA_NO_RECEIVER_JSON,
  SYNTH_BOA_NO_RECEIVER_ROW,
  SYNTH_BOA_REF,
  SYNTH_BOA_SLIP_LINK,
  SYNTH_BOA_SUFFIX,
} from "../fixtures/boa/no-receiver";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const API = "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/";

describe("splitBoaSlipId", () => {
  it("splits an FT reference + 5-digit suffix", () => {
    expect(splitBoaSlipId(`${SYNTH_BOA_REF}${SYNTH_BOA_SUFFIX}`)).toEqual({ reference: SYNTH_BOA_REF, accountNumber: SYNTH_BOA_SUFFIX });
  });

  it("keeps a reference whose own last characters are digits intact", () => {
    // FT + 10 chars ending in digits, then the 5-digit suffix.
    expect(splitBoaSlipId("FT2699912345" + "67890")).toEqual({ reference: "FT2699912345", accountNumber: "67890" });
  });

  it("uppercases the reference and trims", () => {
    expect(splitBoaSlipId(`  ${SYNTH_BOA_REF.toLowerCase()}${SYNTH_BOA_SUFFIX} `)).toEqual({ reference: SYNTH_BOA_REF, accountNumber: SYNTH_BOA_SUFFIX });
  });

  it("returns null for a bare reference, a wrong length or a non-digit suffix", () => {
    expect(splitBoaSlipId(SYNTH_BOA_REF)).toBeNull();
    expect(splitBoaSlipId(`${SYNTH_BOA_REF}1234`)).toBeNull();
    expect(splitBoaSlipId(`${SYNTH_BOA_REF}123456`)).toBeNull();
    expect(splitBoaSlipId(`${SYNTH_BOA_REF}1234A`)).toBeNull();
    expect(splitBoaSlipId("AB1234567890")).toBeNull();
    expect(splitBoaSlipId("")).toBeNull();
  });
});

describe("detectBankFromUrl: BOA links", () => {
  it("trx with a suffix: reference and account suffix are split", () => {
    expect(detectBankFromUrl(SYNTH_BOA_SLIP_LINK)).toEqual({ bank: "boa", reference: SYNTH_BOA_REF, accountNumber: SYNTH_BOA_SUFFIX });
  });

  it("trx without a suffix: the value is the reference, no account", () => {
    expect(detectBankFromUrl(`https://cs.bankofabyssinia.com/slip/?trx=${SYNTH_BOA_REF}`)).toEqual({ bank: "boa", reference: SYNTH_BOA_REF });
    // Other shapes are passed through unchanged, as before.
    expect(detectBankFromUrl("https://cs.bankofabyssinia.com/slip/?trx=AB12345")).toEqual({ bank: "boa", reference: "AB12345" });
  });

  it("id with an FT reference + suffix uses the same split", () => {
    expect(detectBankFromUrl(`${API}?id=${SYNTH_BOA_REF}${SYNTH_BOA_SUFFIX}`)).toEqual({ bank: "boa", reference: SYNTH_BOA_REF, accountNumber: SYNTH_BOA_SUFFIX });
  });

  it("id with a bare FT reference keeps the whole reference (no letters taken as account digits)", () => {
    expect(detectBankFromUrl(`${API}?id=${SYNTH_BOA_REF}`)).toEqual({ bank: "boa", reference: SYNTH_BOA_REF });
  });

  it("id with another reference shape still takes the trailing 5 digits", () => {
    expect(detectBankFromUrl(`${API}?id=AB1234567890`)).toEqual({ bank: "boa", reference: "AB12345", accountNumber: "67890" });
  });

  it("does not accept a look-alike host", () => {
    expect(detectBankFromUrl(`https://cs.bankofabyssinia.com.evil.example/slip/?trx=${SYNTH_BOA_REF}${SYNTH_BOA_SUFFIX}`)).toBeNull();
  });
});

describe("BOAParser: receipt with no receiver", () => {
  const parser = new BOAParser();

  it("parses without a receiver and reads the fee rows", () => {
    const r = parser.parse(SYNTH_BOA_NO_RECEIVER_JSON, "application/json");
    expect(r.verified).toBe(true);
    expect(r.senderName).toBe("TEST PAYER ONE");
    expect(r.senderAccount).toBe("1******45");
    expect(r.receiverName).toBeUndefined();
    expect(r.receiverAccount).toBeUndefined();
    expect(r.amount).toBe(100);
    expect(r.currency).toBe("ETB");
    expect(r.reference).toBe(SYNTH_BOA_REF);
    expect(r.date).toBe("01/01/26 09:30");
    expect(r.transactionType).toBe("Account Transfer MB Maintenance");
    expect(r.amountInWords).toBe("One Hundred Birr and Zero Cents");
    expect(r.serviceFee).toBe(5);
    // VAT is on the transferred amount here, so it is not reported as VAT on the service fee.
    expect(r.serviceFeeVat).toBeUndefined();
    expect(r.totalPaid).toBe(120);
    expect(r.reason).toBe("Test fee note");
  });

  it("does not expose the phone number or address", () => {
    const r = parser.parse(SYNTH_BOA_NO_RECEIVER_JSON, "application/json");
    const { raw: _raw, ...fields } = r;
    expect(JSON.stringify(fields)).not.toContain("+251900000000");
    expect(JSON.stringify(fields)).not.toContain("Testville");
  });

  it("falls back to the Narrative when there is no Payment Reference", () => {
    const row: Record<string, string> = { ...SYNTH_BOA_NO_RECEIVER_ROW };
    delete row["Payment Reference"];
    const r = parser.parse(JSON.stringify({ body: [row] }), "application/json");
    expect(r.reason).toBe("Testing");
  });

  it("treats blank receiver fields as missing, not as empty strings", () => {
    const row = { ...SYNTH_BOA_NO_RECEIVER_ROW, "Receiver's Name": "  ", "Receiver's Account": "" };
    const r = parser.parse(JSON.stringify({ body: [row] }), "application/json");
    expect(r.receiverName).toBeUndefined();
    expect(r.receiverAccount).toBeUndefined();
  });

  it("falls back to Payer's Name when Source Account Name is missing", () => {
    const row: Record<string, string> = { ...SYNTH_BOA_NO_RECEIVER_ROW };
    delete row["Source Account Name"];
    expect(parser.parse(JSON.stringify({ body: [row] }), "application/json").senderName).toBe("TEST PAYER ONE");
  });

  it("does not crash on a non-object row or a non-array body", () => {
    expect(parser.parse(JSON.stringify({ body: ["x"] }), "application/json").verified).toBe(false);
    expect(parser.parse(JSON.stringify({ body: { 0: {} } }), "application/json").verified).toBe(false);
    expect(parser.parse("null", "application/json").verified).toBe(false);
  });
});

describe("detectInput: BOA slip links", () => {
  it("a slip link with a suffix is BOA and needs no extra field", () => {
    const d = detectInput(SYNTH_BOA_SLIP_LINK);
    expect(d.kind).toBe("url");
    expect(d.bank?.code).toBe("boa");
    expect(d.urlReference).toBe(SYNTH_BOA_REF);
    expect(d.needsAccount).toBe(false);
  });

  it("a slip link without the suffix opens the account field instead of sending a check that must fail", () => {
    const d = detectInput(`https://cs.bankofabyssinia.com/slip/?trx=${SYNTH_BOA_REF}`);
    expect(d.kind).toBe("url");
    expect(d.bank?.code).toBe("boa");
    expect(d.urlReference).toBe(SYNTH_BOA_REF);
    expect(d.needsAccount).toBe(true);
    expect(d.accountDigits).toBe(5);
  });

  it("links for other banks still need no extra field", () => {
    expect(detectInput("https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171").needsAccount).toBe(false);
    expect(detectInput("https://mbreciept.cbe.com.et/fHCxExampleRcpt01").needsAccount).toBe(false);
    expect(detectInput("https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1").needsAccount).toBe(false);
  });

  it("a typed BOA reference asks for the account on the receipt, not the receiving account", () => {
    const d = detectInput(SYNTH_BOA_REF, { overrideBank: "boa" });
    expect(d.bank?.code).toBe("boa");
    expect(d.needsAccount).toBe(true);
    expect(d.accountDigits).toBe(5);
    const keys = accountFieldKeys(d);
    expect(tEn(keys.label, { digits: 5 })).toBe("Account on the receipt, last 5 digits");
    expect(tEn(keys.missing, { digits: 5 })).toMatch(/account on the receipt/);
    expect(tEn(keys.label, { digits: 5 })).not.toMatch(/receiving/i);
  });

  it("other banks keep the receiving-account wording", () => {
    const d = detectInput("FT26SAMPLE01");
    expect(d.bank?.code).toBe("cbe");
    expect(tEn(accountFieldKeys(d).label, { digits: 8 })).toBe("Receiving account, last 8 digits");
  });
});

describe("Verifier: BOA slip link with a mocked bank", () => {
  const v = new Verifier();

  it("verifies a trx link with a suffix: one request to the rebuilt API URL", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request) =>
      new Response(SYNTH_BOA_NO_RECEIVER_JSON, { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "", reference: SYNTH_BOA_SLIP_LINK });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API}?id=${SYNTH_BOA_REF}${SYNTH_BOA_SUFFIX}`);
    if (!r.ok) return;
    expect(r.value.verified).toBe(true);
    expect(r.value.bankCode).toBe("boa");
    expect(r.value.reference).toBe(SYNTH_BOA_REF);
    expect(r.value.amount).toBe(100);
    expect(r.value.totalPaid).toBe(120);
    expect(r.value.serviceFee).toBe(5);
    expect(r.value.serviceFeeVat).toBeUndefined();
    expect(r.value.reason).toBe("Test fee note");
    expect(r.value.receiverName).toBeUndefined();
    expect(r.value.receiverAccount).toBeUndefined();
    expect(r.value).not.toHaveProperty("raw");
  });

  it("an id link verifies the same way", async () => {
    const fetchMock = vi.fn(async () => new Response(SYNTH_BOA_NO_RECEIVER_JSON, { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: `${API}?id=${SYNTH_BOA_REF}${SYNTH_BOA_SUFFIX}` });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a typed account still wins over the link's suffix", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request) => new Response(SYNTH_BOA_NO_RECEIVER_JSON, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await v.verify({ bank: "boa", reference: SYNTH_BOA_SLIP_LINK, accountNumber: "99999" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API}?id=${SYNTH_BOA_REF}99999`);
  });

  it("a trx link without a suffix asks for the account on the receipt and makes no request", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "", reference: `https://cs.bankofabyssinia.com/slip/?trx=${SYNTH_BOA_REF}` });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    if (r.ok) return;
    expect(r.error.kind).toBe("MISSING_INPUT");
    if (r.error.kind !== "MISSING_INPUT") return;
    expect(r.error.field).toBe("accountNumber");
    expect(r.error.message).toMatch(/account on the receipt/);
    expect(r.error.message).not.toMatch(/receiving account/i);
  });

  it("a too-short account gets a message that does not claim it is the receiving account", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: SYNTH_BOA_REF, accountNumber: "123" });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    if (!r.ok) expect(r.error.kind === "MISSING_INPUT" && r.error.message).toBe("Enter at least the last 5 digits of the account number.");
  });
});
