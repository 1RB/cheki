/**
 * Tests for Telebirr and M-Pesa parsers.
 */
import { describe, it, expect } from "vitest";
import { TelebirrParser } from "@/lib/parsers/telebirr";
import { MpesaParser } from "@/lib/parsers/mpesa";
import { detectBank } from "@/lib/banks";

describe("TelebirrParser", () => {
  const parser = new TelebirrParser();

  it("builds correct URL", () => {
    expect(parser.buildUrl("CHQ0FJ403O")).toBe(
      "https://transactioninfo.ethiotelecom.et/receipt/CHQ0FJ403O"
    );
  });

  it("is geo-blocked", () => {
    expect(parser.geoBlocked).toBe(true);
  });

  it("parses valid telebirr HTML", () => {
    const html = `
      <html><body>
        <div>telebirr receipt</div>
        <div>Payer Name</div><div>Abebe Bekele</div>
        <div>Payer telebirr no</div><div>0912345678</div>
        <div>Credited Party name</div><div>Sara Tadesse</div>
        <div>Credited party account no</div><div>0987654321</div>
        <div>500.00 Birr</div>
        <div>15-06-2026 14:30:00</div>
      </body></html>
    `;
    const result = parser.parse(html, "text/html");
    expect(result.verified).toBe(true);
    expect(result.senderName).toBe("Abebe Bekele");
    expect(result.receiverName).toBe("Sara Tadesse");
    expect(result.amount).toBe(500);
    expect(result.currency).toBe("ETB");
  });

  it("returns verified=false for invalid receipt", () => {
    const html = "<html><body>This request is not correct</body></html>";
    const result = parser.parse(html, "text/html");
    expect(result.verified).toBe(false);
  });

  it("returns verified=false for non-telebirr HTML", () => {
    const html = "<html><body>Some other content</body></html>";
    const result = parser.parse(html, "text/html");
    expect(result.verified).toBe(false);
  });

  it("parses mobile select-all plain text", () => {
    // Real-world Android "Select All" copy: labels and values concatenated
    const text = `telebirr receipt
Ethio telecom Share Company TIN No.0000030603VAT Reg. No.012700VAT Reg. Date01/01/2003P.O.Box1047 Addis Ababa, EthiopiaTel .251(0) 115 505 678የቴሌብር ክፍያ መረጃ/telebirr Transaction informationየከፋይ ስማ/Payer NameMohammed Abdulwasi Reshidየከፋይ ቴሌብር ቁ./Payer telebirr no.2519****3764የከፋይ አካውንት አይነት/Payer account typeIndividual Customerየከፋይ ቲን ቁ./ Payer TIN Noየከፋይ ተ.እ.ታ.ቁ./VAT Reg. Noየከፋይ ተ.እ.ታ.ቁ. ምዝገባ ቀን/VAT Reg. Dateየገንዘብ ጠቁቋይ ስማ/Credited Party nameCommercial Bank of Ethiopiaየገንዘብ ጠቁቋይ ቴሌብር ቁ./Credited party account no0003የክፍያው ሁኔታ/transaction statusCompletedየባንክ አካውንት ቁጥር/Bank account number1000560536171 Mr Sami Adil Zekaria
የክፍያ ዝርዝር/ Invoice detailsየክፍያ ቁጥር/Invoice No.የክፍያ ቀን/Payment dateየተከፈለው መጠን/Settled AmountDF72OMW38807-06-2026 18:37:39600 Birr የማህተም ክፍያ/Stamp Duty   0.0 Birr ቅናሽ/Discount Amount   0.0 Birrየአገልግሎት ክፍያ/Service fee   5.22 Birr የአገልግሎት ክፍያ ተ.እ.ታ/Service fee VAT   0.78 Birr ጠቅላላ የተከፈለ/Total Paid Amount   606 Birr     የገንዘቡ ልክ በፊደል/Total Amount in wordsix hundred six birr and zero centየክፍያ ዘዴ/Payment Modetelebirrየክፍያ ምክንያት/Payment ReasonCustomer Transfer from Mobile Money to Bankየክፍያ መንገድ/Payment channelAPI/Appየደንበኛ መልዕክት/Customer NoteUmer ali and Mohammed Abdulwasi`;
    const result = parser.parse(text, "text/html");
    expect(result.verified).toBe(true);
    expect(result.reference).toBe("DF72OMW388");
    expect(result.amount).toBe(600);
    expect(result.totalPaid).toBe(606);
    expect(result.senderName).toBe("Mohammed Abdulwasi Reshid");
    expect(result.bankAccountNumber).toBe("1000560536171");
  });

  it("detects DF prefix as Telebirr", () => {
    expect(detectBank("DF72OMW388")).toBe("telebirr");
    expect(detectBank("DEV5HLXDPV")).toBe("telebirr");
  });
});

describe("MpesaParser", () => {
  const parser = new MpesaParser();

  it("builds correct URL", () => {
    expect(parser.buildUrl("ABC123")).toBe(
      "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=ABC123"
    );
  });

  it("is geo-blocked", () => {
    expect(parser.geoBlocked).toBe(true);
  });

  it("parses valid M-Pesa JSON", () => {
    const json = JSON.stringify({
      senderName: "John Doe",
      receiverName: "Jane Smith",
      amount: "1000",
      currency: "ETB",
      transactionId: "ABC123",
      transactionDate: "2026-06-15",
    });
    const result = parser.parse(json, "application/json");
    expect(result.verified).toBe(true);
    expect(result.senderName).toBe("John Doe");
    expect(result.receiverName).toBe("Jane Smith");
    expect(result.amount).toBe(1000);
  });

  it("returns verified=false for error response", () => {
    const json = JSON.stringify({
      responseCode: "1",
      responseDescription: "Transaction not found",
    });
    const result = parser.parse(json, "application/json");
    expect(result.verified).toBe(false);
  });

  it("returns verified=false for invalid JSON", () => {
    const result = parser.parse("not json", "application/json");
    expect(result.verified).toBe(false);
  });
});
