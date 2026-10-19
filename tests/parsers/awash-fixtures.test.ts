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
    expect(result.reference).toBe("260607112200001");
    expect(result.senderName).toBe("RAHEL  MULUGETA  TESSEMA");
    expect(result.receiverName).toBe("LIDYA MESFIN WOLDE");
    expect(result.amount).toBe(3000);
    expect(result.transactionType).toBe("Send To Bank");
  });

  it("parses IPS Bank Transfer to CBE", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("ips-cbe"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260519150500002");
    expect(result.receiverName).toBe("KALEB DEREJE TADESSE");
    expect(result.receiverAccount).toBe("1000000042558");
    expect(result.amount).toBe(1000);
    expect(result.transactionType).toBe("IPS Bank Transfer");
  });

  it("parses IPS Bank Transfer to Bank of Abyssinia", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("ips-boa"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260518144100003");
    expect(result.receiverName).toBe("ROBEL ABERA NEGASH");
    expect(result.receiverAccount).toBe("200000671");
    expect(result.amount).toBe(1860);
    expect(result.transactionType).toBe("IPS Bank Transfer");
  });

  it("parses Merchant Payment receipt", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("merchant-payment"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260514120700004");
    expect(result.receiverName).toBe("RAHEL MULUGETA");
    expect(result.receiverAccount).toBe("80000800");
    expect(result.amount).toBe(100);
    expect(result.transactionType).toBe("Merchant Payment");
  });

  it("parses Send Money to wallet", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("send-money"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260514120500005");
    expect(result.receiverName).toBe("251900000890/WALLET");
    expect(result.amount).toBe(100);
    expect(result.transactionType).toBe("Send Money");
  });

  it("parses Telebirr Transfer receipt", () => {
    const parser = new AwashParser();
    const result = parser.parse(loadFixture("telebirr-transfer"), "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("260622165000006");
    expect(result.senderName).toBe("Yared Fikru Mengistu");
    expect(result.senderAccount).toBe("01425******8600/BANK");
    expect(result.receiverAccount).toBe("251900000568");
    expect(result.amount).toBe(800);
    expect(result.transactionType).toBe("Telebirr Transfer");
    expect(result.date).toBe("2026-06-22");
  });
});
