import { expect, describe, it } from "vitest";
import { parseReceiptText } from "@/lib/ocr-parser";

const cbeWebText = `01, Kirkos gp City: =
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
§ 3 N EHD \\
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

const telebirrText = `3 ~ x
800 I» 1&1 © 0 © 410%
o— tes a 0S 4
% transactioninfoethiotelecomet/rece 8 A
<2
. Ethio telecom
(© tioteleam ~ svn
Ce © TIN No. 0000030603
VAT Reg. No, 012700
VAT Reg Date 01/01/2003
POBox 1047 Addis Ababa, Ethiopia
Tel 251(0) 115 505 678
BANC NES (DCB /telebirr Transaction information
Nee N7°/Payer Name Sami Adil Zekaria
he. ANC %/Payer telebirr no. 2519"***2872
TNL ANDI REVY/Payer account type Individual Customer
Nee £2 %/ Payer TIN No
?he.g +2F.%/VAT Reg. No
?he.g +AF.& HIN $/VAT Reg. Date
PVH t¢NL N9°/Credited Party name Commercial Bank of Ethiopia
$HA +4NL BANC /Credited party account no 0003
PESO U3F/transaction status Completed
£170 XN@IT «DC/Bank account number 1000370251685 Mr Mohammed Abdulwasi Reshid
FASS HOHE Invoice details
PRES $M C/Invoice No. thes ¢)/Payment date [ £+hEA®- (DM)/Settled Amount
CGHLDQDUD 18-07-2025 19:58:20 | 1100.00 Birr
£99UT9° h&$/Stamp Duty | 0.0 Birr
#4Ti/Discount Amount. | 008i
PRAT NES/Service fee 5.22 Birr
XIN REP TAF/Service fee VAT | 078 Birr
MPAA $HNLA/ Total Paid Amount | 1106.00 Birr
ANT RT,
4 [a AOI 2 A
R17HN AR NE.LA/Total Amountinword one thousand, one hundred six Wf efind2egoecamt~ *, =.
?hES He/Payment Mode telebirr
PRES T°NI$/Payment Reason Customer Transfer from Mobi Maney {o Gai | >; ||
PAGS (0)12/Payment channel APVADD | CPA el AY |
PRINT (DAONT/Customer Note \\ % ore J
[Ck reai0]
feria
aa TR
SEER
Scan the GR using telebir SuperApp to verify he payment
BACH NATMS NDATISAY/ Thank you for using telebirr p_
AtERI9¢ DCE /Please contact uss
[AC 3 5 “P
Download PDF
@ a :
.
W 0 :`;

const boa1Text = `NE Roaze am
¢I& Bank of Abyssinia
Source Account T****134
Source Account Name EYOUEL ARAGAW HAILE
Amount ETB 1,107.59
Receiver Account 1#2%%685
Receiver Nae MOHAMMED ABDULWASI
RESHID
Transaction Date 19/07/2025, 17:32:13
Transaction Reference FT252003JZPP
Transaction Type Ot
Bank Name “Rh o
thiopia
Note
BleimiE]
1 SAPRELE
v=o herp EE LA
SE dary
[zee 0
Scan the QR to Verify
(TEETER,
| The Choice For All 4 )
60 9 @ 6 © 6 © 0`;

const cbeModalText = `9 Thank you < ¥ x
Success
Message
ETB 20,000.00 debited from MOHAMMED
ABDULWASI RESHID for SAMI ADIL ZEKARIA-
ETB-6171 on 20-May-2026 with transaction
ID: FT26140P01YB. Total Amount Debited ETB
20000.00 with commission of ETB 0.00 , 15%
VAT of ETB0.00 and 5% Disaster Fund
ofETB0.00.
[=] | [=]
T oad
Et
uf 1 |
[
fo Commercial Bank of Ethiopia
S \\ The Bank You can always Rely on!
—`;

const boa2Text = `NE noage arn
‘ily Bank of Abyssinia
Source Account 2x *2057
Source Account Name HABIB DAOUD OMAR
Amount ETB 30,124.20
Receiver Account 1****674
Receiver Name ABADIR MESGID
Transaction Date 16/06/2026, 20:29:42
Transaction Reference FT26167ZVPCJ
Transaction Type Other Bagk Transfer
Bank Name com Bg
iopia
Note Z
[Er axes]
AAR H
4 pd A
td
Fuel Sl
Aaa
oO Tala
Scan the QR to Verify
{The choice Forall
OO © © 6 © © ©`;

describe("screenshot OCR parser cases", () => {
  it("parses CBE web receipt (FT26170NPPON)", () => {
    const result = parseReceiptText(cbeWebText);
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

  it("parses Telebirr web receipt (Invoice No. label, mixed labels)", () => {
    const result = parseReceiptText(telebirrText);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("telebirr");
    expect(result?.reference).toBe("CGHLDQDUD");
    expect(result?.confidence).toBe("high");
  });

  it("parses Bank of Abyssinia receipt 1 (FT252003JZPP)", () => {
    const result = parseReceiptText(boa1Text);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("boa");
    expect(result?.reference).toBe("FT252003JZPP");
  });

  it("parses CBE success modal (FT26140P01YB)", () => {
    const result = parseReceiptText(cbeModalText);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("cbe");
    expect(result?.reference).toBe("FT26140P01YB");
    expect(result?.confidence).toBe("high");
  });

  it("parses Bank of Abyssinia receipt 2 (FT26167ZVPCJ)", () => {
    const result = parseReceiptText(boa2Text);
    expect(result).toBeTruthy();
    expect(result?.bank).toBe("boa");
    expect(result?.reference).toBe("FT26167ZVPCJ");
  });
});
