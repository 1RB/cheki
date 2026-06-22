import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { AwashParser } from "@/lib/parsers/awash";

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "../fixtures/awash", `${name}.html`), "utf-8");
}

describe("Awash parser fixtures", () => {
  it("parses Send To Bank receipt", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("send-to-bank"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260607112275735");
    expect(result.senderName).toBe("MEDINA  KASSAHUN  MOHAMMED");
    expect(result.receiverName).toBe("HLIMET DEMSE KEBEDE");
    expect(result.amount).toBe(3000);
    expect(result.transactionType).toBe("Send To Bank");
  });

  it("parses IPS Bank Transfer to CBE", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("ips-cbe"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260519150599664");
    expect(result.receiverName).toBe("SEID YIMAM MUSTEFA");
    expect(result.receiverAccount).toBe("1000039642558");
    expect(result.amount).toBe(1000);
    expect(result.transactionType).toBe("IPS Bank Transfer");
  });

  it("parses IPS Bank Transfer to Bank of Abyssinia", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("ips-boa"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260518144180968");
    expect(result.receiverName).toBe("NURI KEDIR KEMAL");
    expect(result.receiverAccount).toBe("241773671");
    expect(result.amount).toBe(1860);
    expect(result.transactionType).toBe("IPS Bank Transfer");
  });

  it("parses Merchant Payment receipt", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("merchant-payment"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260514120752793");
    expect(result.receiverName).toBe("MEDINA KASSAHUN");
    expect(result.receiverAccount).toBe("82795800");
    expect(result.amount).toBe(100);
    expect(result.transactionType).toBe("Merchant Payment");
  });

  it("parses Send Money to wallet", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("send-money"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260514120550963");
    expect(result.receiverName).toBe("251935402890/WALLET");
    expect(result.amount).toBe(100);
    expect(result.transactionType).toBe("Send Money");
  });
});
