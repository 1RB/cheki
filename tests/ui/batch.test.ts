/**
 * Batch check: the total, the duplicate flag, and what the CSV and the copied
 * summary may carry.
 */
import { describe, it, expect } from "vitest";
import { batchCsv, batchText, markDuplicates, summarize, type BatchRow } from "@/lib/verify/batch";
import type { Verdict } from "@/lib/verify/verdict";

const bank = { code: "cbe", name: "Commercial Bank of Ethiopia", shortName: "CBE", type: "bank" } as Verdict["bank"];

function verified(ref: string, value: number, extra: Partial<Verdict> = {}): Verdict {
  return {
    kind: "verified",
    tone: "green",
    title: "Verified",
    subtitle: "CBE confirmed this receipt",
    showDetails: true,
    amount: { value, currency: "ETB" },
    from: { name: "ABEBE K", account: "1****1234" },
    to: { name: "SHOP", account: "1****9999" },
    date: "2026-10-19",
    reference: ref,
    bank,
    checks: [],
    ...extra,
  } as Verdict;
}

function failed(ref: string): Verdict {
  return { kind: "notFound", tone: "red", title: "Not found", subtitle: "", showDetails: false, amount: { value: 4321, currency: "ETB" }, reference: ref, bank, checks: [] } as unknown as Verdict;
}

const done = (name: string, verdict: Verdict): BatchRow => ({ name, status: "done", verdict });

describe("batch", () => {
  it("counts a receipt that appears twice once, and flags the later copy", () => {
    const rows = markDuplicates([
      done("a.png", verified("FT26AAA", 1000)),
      done("b.png", verified("ft26aaa ", 1000)),
      done("c.png", verified("FT26BBB", 250.5)),
    ]);
    expect(rows[0].duplicateOf).toBeUndefined();
    expect(rows[1].duplicateOf).toBe(0);
    const s = summarize(rows);
    expect(s).toMatchObject({ total: 3, finished: 3, confirmed: 2, duplicates: 1, attention: 1 });
    expect(s.amounts).toEqual([{ currency: "ETB", value: 1250.5 }]);
  });

  it("the same reference at two banks is two receipts", () => {
    const other = { ...bank, code: "boa", shortName: "BOA" } as Verdict["bank"];
    const rows = markDuplicates([done("a", verified("FT26AAA", 1)), done("b", verified("FT26AAA", 1, { bank: other }))]);
    expect(rows[1].duplicateOf).toBeUndefined();
  });

  it("a duplicate clears when the first copy is re-read as something else", () => {
    let rows = markDuplicates([done("a", verified("FT26AAA", 1)), done("b", verified("FT26AAA", 1))]);
    rows = markDuplicates([done("a", verified("FT26ZZZ", 1)), rows[1]]);
    expect(rows[1].duplicateOf).toBeUndefined();
  });

  it("only bank-confirmed receipts add to the total; pending rows are not finished", () => {
    const s = summarize([done("a", failed("FT26X")), { name: "b", status: "checking" }, { name: "c", status: "noReceipt" }]);
    expect(s).toMatchObject({ total: 3, finished: 2, confirmed: 0, attention: 2, amounts: [] });
  });

  it("the CSV carries amounts and names only for confirmed first copies, and defuses formulas", () => {
    const rows = markDuplicates([
      done("=cmd|'/c calc'!A1.png", verified("FT26AAA", 1000)),
      done("b.png", verified("FT26AAA", 1000)),
      done("c.png", failed("FT26CCC")),
    ]);
    const lines = batchCsv(rows).trim().split("\r\n");
    expect(lines[0]).toBe("#,file,outcome,bank,reference,amount,currency,from,to,date,same_as");
    expect(lines[1]).toContain(`'=cmd|'/c calc'!A1.png`);
    expect(lines[1]).toContain(",verified,CBE,FT26AAA,1000,ETB,ABEBE K 1****1234,SHOP 1****9999,2026-10-19,");
    expect(lines[2]).toBe("2,b.png,duplicate,CBE,FT26AAA,,,,,,1");
    expect(lines[3]).toBe("3,c.png,notFound,CBE,FT26CCC,,,,,,");
    expect(batchCsv(rows)).not.toContain("4321");
  });

  it("the copied summary leads with the confirmed count and total", () => {
    const rows = markDuplicates([done("a", verified("FT26AAA", 1000)), done("b", failed("FT26B"))]);
    const text = batchText(rows, { title: "Batch check", confirmed: "confirmed by the bank", attention: "need a look" });
    expect(text.split("\n")).toEqual([
      "Batch check: 1/2 confirmed by the bank (1,000 ETB)",
      "1 need a look",
      "1. verified 1,000 ETB FT26AAA",
      "2. notFound FT26B",
    ]);
  });
});
