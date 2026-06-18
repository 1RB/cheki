import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BANK_LIST = [
  {
    code: "cbe",
    name: "Commercial Bank of Ethiopia",
    status: "live",
    requiresAccount: true,
    accountDigits: 8,
    requiresPhone: false,
    responseType: "pdf",
    endpoint: "https://apps.cbe.com.et:100/?id={reference}{last_8_digits}",
  },
  {
    code: "boa",
    name: "Bank of Abyssinia",
    status: "live",
    requiresAccount: true,
    accountDigits: 5,
    requiresPhone: false,
    responseType: "json",
    endpoint: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={reference}{last_5_digits}",
  },
  {
    code: "telebirr",
    name: "Telebirr",
    status: "geo-blocked",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "html",
    endpoint: "https://transactioninfo.ethiotelecom.et/receipt/{reference}",
    note: "Blocks requests from non-Ethiopian IPs.",
  },
  {
    code: "mpesa",
    name: "M-Pesa Ethiopia",
    status: "geo-blocked",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "json",
    endpoint: "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={reference}",
    note: "Blocks requests from non-Ethiopian IPs.",
  },
  {
    code: "zemen",
    name: "Zemen Bank",
    status: "coming_soon",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "pdf",
    endpoint: "https://share.zemenbank.com/rt/{reference}/pdf",
  },
  {
    code: "dashen",
    name: "Dashen Bank",
    status: "coming_soon",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "pdf",
    endpoint: "https://receipt.dashensuperapp.com/receipt/{reference}",
    note: "Endpoint often returns 500. May be geo-blocked.",
  },
  {
    code: "awash",
    name: "Awash Bank",
    status: "coming_soon",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "html",
    endpoint: "https://awashpay.awashbank.com:8225/-{reference}",
    note: "Port 8225 returns 403. URL pattern uncertain.",
  },
  {
    code: "cbebirr",
    name: "CBE Birr",
    status: "coming_soon",
    requiresAccount: false,
    requiresPhone: true,
    responseType: "html",
    endpoint: "https://cbepay1.cbe.com.et/aureceipt?TID={reference}&PH={phone}",
    note: "Server currently times out.",
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    count: BANK_LIST.length,
    banks: BANK_LIST,
  });
}
