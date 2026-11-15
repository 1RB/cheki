/**
 * Three vocabularies, one reading each, so a new word in any of them cannot
 * slip through unnoticed:
 *
 *  - the manifest's bank status ("live" | "in-development") maps to the UI's
 *    legacy words ("live" | "soon") exactly once, and every bank maps;
 *  - status.json rows speak HealthStatus, whose one list (HEALTH_STATUSES,
 *    src/lib/health.ts) the committed file is checked against;
 *  - the /endpoints format tag says whether cheki fetches a format, which is
 *    isSupportedFormat's call (has a parser, not retired), never the status
 *    alone. The old tag read the status only, so it called a current format
 *    with a parser "Newer, not supported yet" and a legacy format without
 *    one "Still checked" - both lies the instant the manifest data says
 *    something the old code never saw.
 */
import { describe, expect, it } from "vitest";
import { getAllBanks } from "@/lib/manifest/loader";
import { getBank as getUiBank } from "@/lib/banks";
import { formatsOf, isSupportedFormat } from "@/lib/manifest/formats";
import { formatStatusTag, healthFormatId } from "@/lib/status-view";
import { HEALTH_STATUSES } from "@/lib/health";
import { statusFile } from "@/lib/status-data";
import type { ReceiptFormat } from "@/lib/core/types";

describe("the /endpoints format tag", () => {
  it("agrees with isSupportedFormat for every format in the manifest", () => {
    for (const bank of getAllBanks()) {
      for (const f of formatsOf(bank)) {
        expect(formatStatusTag(f) === "Still checked", `${bank.id}/${f.id}`).toBe(isSupportedFormat(f));
      }
    }
  });

  it("tells the truth for every status/parser pair, including ones no bank has yet", () => {
    const fmt = (status: ReceiptFormat["status"], parser?: string): ReceiptFormat =>
      ({ id: "f", label: "F", status, inputs: [], ...(parser ? { parser } : {}) }) as unknown as ReceiptFormat;
    // Checked means fetched: a parser and not retired, whatever the status says.
    expect(formatStatusTag(fmt("current", "p"))).toBe("Still checked");
    expect(formatStatusTag(fmt("legacy", "p"))).toBe("Still checked");
    // Unchecked means not fetched, and the status only words the reason.
    expect(formatStatusTag(fmt("current"))).toBe("Newer, not supported yet");
    expect(formatStatusTag(fmt("legacy"))).toBe("Not checked");
    expect(formatStatusTag(fmt("deprecated"))).toBe("Retired");
    expect(formatStatusTag(fmt("deprecated", "p"))).toBe("Retired");
  });
});

describe("bank status vocabularies", () => {
  it("the manifest speaks exactly live|in-development, and the UI maps each once", () => {
    const seen = new Set<string>();
    for (const entry of getAllBanks()) {
      seen.add(entry.status);
      const ui = getUiBank(entry.id);
      if (!ui) continue;
      expect(ui.status, entry.id).toBe(entry.status === "live" ? "live" : "soon");
    }
    expect([...seen].sort()).toEqual(["in-development", "live"]);
  });

  it("maps every manifest bank except the one parser-only alias", () => {
    // manifestToBank's `entry.status === "live" ? "live" : "soon"` would turn
    // any new status word into "soon"; the vocabulary pin above fails first,
    // and this pin fails if an alias appears without being filtered out.
    const unmapped = getAllBanks().filter((b) => !getUiBank(b.id)).map((b) => b.id);
    expect(unmapped).toEqual(["cbe-new"]);
  });

  it("status.json only speaks the words HealthStatus knows", () => {
    // status.json is written by CI (scripts/health-check.ts). If the runner
    // ever writes a new status word, bankState's exhaustive switch refuses it
    // at compile time; this pins the committed file to the same list.
    for (const row of statusFile.banks) expect(HEALTH_STATUSES, row.id).toContain(row.status);
  });

  it("keys every health row as bank, or bank:format, and reads it back", () => {
    // health.ts builds "<bank>:<formatId>" for an older format's row and
    // "<bank>" for the bank's own; status-view reads both (legacyHealth,
    // healthFormatId). A key that parses to a bank or format that does not
    // exist would render a raw fragment as the format's name.
    const bankIds = new Set(getAllBanks().map((b) => b.id));
    const formatIds = new Map(getAllBanks().map((b) => [b.id, new Set((b.formats ?? []).map((f) => f.id))]));
    for (const row of statusFile.banks) {
      const fid = healthFormatId(row.id);
      if (fid === undefined) {
        expect(bankIds, row.id).toContain(row.id);
      } else {
        const bankId = row.id.slice(0, row.id.indexOf(":"));
        expect(bankIds, row.id).toContain(bankId);
        expect(formatIds.get(bankId) ?? new Set(), row.id).toContain(fid);
      }
    }
    expect(healthFormatId("cbe:cbe-ft-pdf")).toBe("cbe-ft-pdf");
    expect(healthFormatId("cbe")).toBeUndefined();
    expect(healthFormatId("cbe:")).toBeUndefined();
  });
});
