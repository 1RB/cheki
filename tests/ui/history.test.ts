import { describe, it, expect, beforeEach } from "vitest";
import { addVerified, clearRecent, findPrevious, loadRecent, removeRecent, HISTORY_KEY, LEGACY_HISTORY_KEY } from "@/lib/verify/history";

class MemoryStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

let store: MemoryStore;
beforeEach(() => { store = new MemoryStore(); });

const verified = { success: true, verified: true, amount: 500, currency: "ETB", senderName: "Abebe", receiverName: "Shop", reference: "FT1" };

describe("recent checks", () => {
  it("saves verified results only", () => {
    let list = addVerified([], { success: true, verified: false, decodedOnly: true, amount: 9 }, { bank: "boa", ref: "X" }, new Date(), store);
    expect(list).toEqual([]);
    list = addVerified(list, { success: true, parsed: true }, { bank: "telebirr", ref: "Y" }, new Date(), store);
    list = addVerified(list, { success: false, verified: true }, { bank: "cbe", ref: "Z" }, new Date(), store);
    expect(list).toEqual([]);
    list = addVerified(list, verified, { bank: "cbe", ref: "FT1" }, new Date(), store);
    expect(list).toHaveLength(1);
  });

  it("stores no names", () => {
    addVerified([], verified, { bank: "cbe", ref: "FT1" }, new Date(), store);
    const raw = store.getItem(HISTORY_KEY)!;
    expect(raw).not.toMatch(/Abebe|Shop|senderName|receiverName/);
    expect(JSON.parse(raw)[0]).toMatchObject({ bank: "cbe", ref: "FT1", amount: 500, currency: "ETB" });
  });

  it("migrates the legacy key without its names", () => {
    store.setItem(LEGACY_HISTORY_KEY, JSON.stringify([{ bank: "cbe", ref: "FT9", date: "2026-10-01T10:00:00Z", amount: 7, senderName: "Old Name", receiverName: "Old Shop" }]));
    const list = loadRecent(store);
    expect(list).toHaveLength(1);
    expect(store.getItem(LEGACY_HISTORY_KEY)).toBeNull();
    expect(store.getItem(HISTORY_KEY)).not.toMatch(/Old Name|Old Shop/);
  });

  it("ignores junk and hand-edited entries", () => {
    store.setItem(HISTORY_KEY, JSON.stringify([{ ref: "<img>", bank: "cbe", checkedAt: "nope" }, 5, null, { bank: "cbe", ref: "FT2", checkedAt: "2026-10-01T10:00:00Z", senderName: "x", amount: "1e9" }]));
    const list = loadRecent(store);
    expect(list).toEqual([{ bank: "cbe", ref: "FT2", checkedAt: "2026-10-01T10:00:00.000Z" }]);
    store.setItem(HISTORY_KEY, "{not json");
    expect(loadRecent(store)).toEqual([]);
  });

  it("finds an earlier check, removes one row and clears all", () => {
    let list = addVerified([], verified, { bank: "cbe", ref: "FT1" }, new Date(), store);
    list = addVerified(list, { ...verified, reference: "FT2" }, { bank: "cbe", ref: "FT2" }, new Date(), store);
    expect(findPrevious(list, "cbe", "ft1")?.ref).toBe("FT1");
    expect(findPrevious(list, "dashen", "FT1")).toBeUndefined();
    list = removeRecent(list, { bank: "cbe", ref: "FT1" }, store);
    expect(list.map((c) => c.ref)).toEqual(["FT2"]);
    expect(clearRecent(store)).toEqual([]);
    expect(store.getItem(HISTORY_KEY)).toBeNull();
  });

  it("keeps the newest first and de-duplicates", () => {
    let list = addVerified([], verified, { bank: "cbe", ref: "FT1" }, new Date(1), store);
    list = addVerified(list, verified, { bank: "cbe", ref: "FT1" }, new Date(2), store);
    expect(list).toHaveLength(1);
    expect(list[0].checkedAt).toBe(new Date(2).toISOString());
  });
});

describe("history: BOA QR payloads", () => {
  const QR = Buffer.alloc(96, 7).toString("base64");
  it("stores the bank's reference, never the QR payload", () => {
    const mem = new Map<string, string>();
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const list = addVerified([], { success: true, verified: true, bankCode: "boa", reference: "FT252003JZPP", amount: 5 }, { bank: "boa", ref: QR }, new Date(), s);
    expect(list[0].ref).toBe("FT252003JZPP");
    expect(mem.get(HISTORY_KEY)).not.toContain(QR.slice(0, 40));
  });
  it("drops a stored QR payload on read", () => {
    const mem = new Map<string, string>([[HISTORY_KEY, JSON.stringify([{ bank: "boa", ref: QR, checkedAt: new Date().toISOString() }])]]);
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    expect(loadRecent(s)).toEqual([]);
  });
});
