import { expect, describe, it } from "vitest";
import { parseReceiptText } from "@/lib/ocr-parser";

const cbeText = `01, Kirkos gp City: =
Postal code: 255 Wereda/Kebele: =
SWIFT Code: CBETETAA VAT Registration No: p
Email: info@cbe.com.et VAT Registration Date: =
Tel: +251-551-50-04 TN (TAX ID): 5
Fax: +251-551-45-22 Branch: pi
Tin: 0000006966
VAT Receipt No: FT26170NPPON
VAT Registration No: 011140
VAT Registration 01/01/2003
Date:
Payment / Transaction Informations
Payer: Raeed Ansar Yusuf
Account: Txx*%8348
Receiver: Abadir Mesgid
Account: 1x xx%2674
Payment Date & Time: Jun 19, 2026, 4:45 PM
~~
Reference No. (VAT Invgs : +> oN FT26170NPPON
Pa ;
* oN
Reason / Type of fegflce: FRA MB transfer
i £ iii 3%
§ 3 N EHD \
Transferred A i NG - YY 400000ETB
ce CX
Service Chargd\\(i51. TR AVHRR > 0.00 ETB
5% Disaster Recovery): \\, |i 9,
PSN A > *'G,
Total amount debite@fiBthio0" 4000.00 ETB
customer's account: EE h
Amount in Word:
Four Thousand ETB
[=] £55 [E]
Download PDF
Ld | pong!`;

const awash1Text = `17100 © @ ae all = @

< Receipt 154
\\
A Ee
Xr |
= AwashBank (5)
Transaction Successful

Transaction Time 2026-03-28 05:10:38 PM

Transaction Type IPS Bank Transfer

Amount 1000 ETB

VAT 0.90 ETB

Sender Name OMER AHMED

MOHAMMEDSHERIF

Sender Account 071425******500

Beneficiary name SELEHADIN AMIR

TN ABDULWEHAB

Beneficiary Account 5” 1000225027408

< 7 02 [=
Beneficiary Bank Soe of Ethiopia
528
Reason Awase>” Sunday football
Transaction ID 260328171079006
Thank you for banking with us
< 3`;

const awash2Text = `18230 @@ an all = @7
< Receipt 154
\\
ho =
NX |
= AwashBank (5)
Transaction Successful
Transaction Time 2026-04-01 06:22:57 PM
Transaction Type IPS Bank Transfer
Amount 900 ETB
VAT 0.81 ETB
Sender Name OMER AHMED
MOHAMMEDSHERIF
Sender Account 071425******500
Beneficiary name SELEHADIN AMIR
NN ABDULWEHAB
v &
Beneficiary Account | 7 1000225027408
< 2 [=]
Beneficiary Bank =) Sommer alBank of Ethiopia
528
Reason Aw Ash” Sunday football
Transaction ID 260401182242481
Thank you for banking with us
< 3`;

const dashenText = `558 MO ® ~ [|
A
a Bi QR Code
"Sf
Money Successfully Sent!
You have successfully sent money! Thank you
for using our service.
1,200.00
Sender Name: Mohammed Adil Zekaria
Sender Account: 2933***+%%Q1]
Recipient Account: 1000560536171
Recipient Name: Sami Adil Zekaria
Budget: Off Budget
Date: Jun 21,2025 05:58 AM
FT Ref: D3I0BTI251720001
Transaction Ref: OBTI28455679126320660525
Service-Charge: 4.80ETB
VAT(15%): 0.72ETB
Back To Home`;

describe("screenshot OCR parser cases", () => {
  it("parses CBE transfer receipt (FT26170NPPON)", () => {
    const result = parseReceiptText(cbeText);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("cbe");
    expect(result?.reference).toBe("FT26170NPPON");
    expect(result?.confidence).toBe("high");
  });

  it("parses Awash app receipt 1 (numeric transaction ID)", () => {
    const result = parseReceiptText(awash1Text);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("awash");
    expect(result?.reference).toBe("260328171079006");
    expect(result?.message).toContain("share link or QR code");
  });

  it("parses Awash app receipt 2 (numeric transaction ID)", () => {
    const result = parseReceiptText(awash2Text);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("awash");
    expect(result?.reference).toBe("260401182242481");
    expect(result?.message).toContain("share link or QR code");
  });

  it("parses Dashen app receipt (prefers Transaction Ref over FT Ref)", () => {
    const result = parseReceiptText(dashenText);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("dashen");
    expect(result?.reference).toBe("OBTI28455679126320660525");
    expect(result?.confidence).toBe("high");
  });
});
