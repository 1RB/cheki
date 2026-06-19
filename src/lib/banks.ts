export interface Bank {
  code: string;
  name: string;
  shortName: string;
  type: "bank" | "wallet" | "mobile";
  requiresAccount: boolean;
  accountLabel?: string;
  accountDigits?: number;
  requiresPhone?: boolean;
  status: "live" | "soon";
  refPattern?: RegExp;
  refPrefixes?: string[];
  color: string;
  geoBlocked?: boolean;
  endpoint: string;
  endpointFormat: string;
  responseType: "pdf" | "html" | "json";
  description: string;
  referenceFormat: string;
  referenceExample: string;
  howToVerify: string[];
  useCases: string[];
  faq: { q: string; a: string }[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export const banks: Bank[] = [
  {
    code: "cbe",
    name: "Commercial Bank of Ethiopia",
    shortName: "CBE",
    type: "bank",
    requiresAccount: true,
    accountLabel: "Receiving account number",
    accountDigits: 8,
    status: "live",
    refPattern: /^FT/i,
    refPrefixes: ["FT"],
    color: "#1a5c3e",
    endpoint: "apps.cbe.com.et:100",
    endpointFormat: "https://apps.cbe.com.et:100/?id={REFERENCE}{LAST_8_DIGITS_OF_ACCOUNT}",
    responseType: "pdf",
    description:
      "Commercial Bank of Ethiopia (CBE) is the largest bank in Ethiopia and the most common settlement rail for Ethiopian businesses. CBE receipts are published as public PDF documents accessible via a URL combining the FT transaction reference and the last 8 digits of the receiving account number.",
    referenceFormat: "FT followed by 10 alphanumeric characters (e.g. FT26140P01YB)",
    referenceExample: "FT26140P01YB",
    howToVerify: [
      "Get the FT reference number from the customer's receipt (starts with FT)",
      "Get the last 8 digits of your receiving CBE account number",
      "cheki fetches the official PDF from CBE's public endpoint and extracts payment data",
    ],
    useCases: [
      "Retail counters confirming in-person CBE transfers",
      "Delivery teams validating payment before handover",
      "Finance teams reconciling daily CBE inflows",
      "Developers automating CBE checks through the REST API",
    ],
    faq: [
      {
        q: "What is a CBE FT reference number?",
        a: "The FT reference is a unique transaction identifier assigned by CBE to every transfer. It appears on the customer's receipt and starts with the letters FT followed by 10 alphanumeric characters, such as FT26140P01YB.",
      },
      {
        q: "Can I verify CBE with only the reference number?",
        a: "No. CBE's public receipt endpoint requires both the FT reference and the last 8 digits of the receiving account number. This is a security measure to prevent receipt enumeration. cheki asks for both fields when CBE is selected.",
      },
      {
        q: "Does CBE charge for receipt verification?",
        a: "No. The CBE receipt endpoint is a public URL that returns a PDF. Anyone can access it for free. check.et and verify.et charge you for hitting this same URL.",
      },
      {
        q: "Why does cheki need my account number?",
        a: "CBE's receipt URL is constructed as the FT reference concatenated with the last 8 digits of the receiving account. Without the account digits, the URL returns a 404. cheki only uses the last 8 digits and never stores the full account number.",
      },
    ],
    seo: {
      title: "Verify CBE Transactions Online",
      description:
        "Verify Commercial Bank of Ethiopia (CBE) transactions for free. Check FT reference numbers against official CBE receipt endpoints. No signup, no API key.",
      keywords: [
        "CBE receipt verification",
        "verify CBE transaction",
        "FT reference number",
        "Commercial Bank of Ethiopia receipt",
        "CBE payment check",
        "ethiopian bank receipt verify",
      ],
    },
  },
  {
    code: "telebirr",
    name: "Telebirr",
    shortName: "Telebirr",
    type: "mobile",
    requiresAccount: false,
    status: "live",
    refPattern: /^(DET|CHQ|DAB|DEL|ADQ|DEP|CHG|CHA|CHB|CHC|CHD|CHE|CHF|DEB|DEC|DED|DEE|DEF|DEG|DEH|DEI|DEJ|DEK|DEL|DEM|DEN|DEO|DEP|DEQ|DER|DES|DET|DEU|DEV|DEW|DEX|DEY|DEZ)/i,
    refPrefixes: ["DET", "CHQ", "DAB", "DEL", "ADQ", "DEP"],
    color: "#e8a000",
    geoBlocked: true,
    endpoint: "transactioninfo.ethiotelecom.et",
    endpointFormat: "https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}",
    responseType: "html",
    description:
      "Telebirr is Ethio Telecom's mobile money service and the most widely used digital wallet in Ethiopia. Telebirr receipts are published as public HTML pages accessible via a URL containing only the transaction reference number. The endpoint is geo-blocked to Ethiopian IP addresses.",
    referenceFormat: "2-3 letter prefix followed by 6-8 alphanumeric characters (e.g. DET8FJGUJ4, CHQ0FJ403O)",
    referenceExample: "DET8FJGUJ4",
    howToVerify: [
      "Get the transaction reference from the customer's Telebirr SMS or receipt",
      "The reference starts with a 2-3 letter prefix (DET, CHQ, DAB, DEL, ADQ, etc.)",
      "cheki fetches the receipt from Telebirr's public endpoint and extracts payment data",
    ],
    useCases: [
      "Shops confirming Telebirr payments at the counter",
      "Online stores verifying Telebirr payments before fulfillment",
      "Delivery services validating payment before handover",
      "Marketplaces integrating Telebirr verification via API",
    ],
    faq: [
      {
        q: "What does a Telebirr reference number look like?",
        a: "Telebirr transaction references start with a 2-3 letter prefix followed by 6-8 alphanumeric characters. Common prefixes include DET, CHQ, DAB, DEL, and ADQ. The full reference is sent via SMS to both payer and receiver after each transaction.",
      },
      {
        q: "Why does Telebirr verification fail from outside Ethiopia?",
        a: "Telebirr's receipt endpoint (transactioninfo.ethiotelecom.et) blocks requests from IP addresses outside Ethiopia. This is a network-level restriction. cheki provides a fallback URL so users on Ethiopian networks can open the receipt directly in their browser.",
      },
      {
        q: "Can I self-host cheki for Telebirr verification?",
        a: "Yes. Running cheki on a server with an Ethiopian IP address (or using X-Forwarded-For with an Ethiopian IP from a residential connection) bypasses the geo-block. See the Docker self-hosting guide in the GitHub repository.",
      },
      {
        q: "Is Telebirr receipt verification free?",
        a: "Yes. The Telebirr receipt URL is public and returns an HTML page with transaction details. check.et and verify.et charge you for fetching this same URL. cheki does it for free.",
      },
    ],
    seo: {
      title: "Verify Telebirr Transactions Online",
      description:
        "Verify Telebirr (Ethio Telecom) transactions for free. Check transaction references against official Telebirr receipt endpoints. No signup, no API key.",
      keywords: [
        "telebirr receipt verification",
        "verify telebirr transaction",
        "telebirr transaction ID",
        "ethio telecom receipt check",
        "telebirr payment verify",
        "ethiopian mobile money verification",
      ],
    },
  },
  {
    code: "boa",
    name: "Bank of Abyssinia",
    shortName: "BOA",
    type: "bank",
    requiresAccount: true,
    accountLabel: "Receiving account number",
    accountDigits: 5,
    status: "live",
    refPattern: /^[A-Z]{2}\d/i,
    refPrefixes: ["Various"],
    color: "#7c3aed",
    endpoint: "cs.bankofabyssinia.com",
    endpointFormat: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}",
    responseType: "json",
    description:
      "Bank of Abyssinia (BOA) is one of Ethiopia's largest private banks. BOA publishes receipt data as JSON via a public API endpoint that requires the transaction reference and the last 5 digits of the receiving account number. Unlike some competitors, cheki does not need Selenium or a headless browser for BOA verification.",
    referenceFormat: "Alphanumeric reference starting with 2 letters (varies by transaction type)",
    referenceExample: "AB12345678",
    howToVerify: [
      "Get the transaction reference from the customer's BOA receipt",
      "Get the last 5 digits of your receiving BOA account number",
      "cheki calls BOA's public JSON API and returns structured payment data",
    ],
    useCases: [
      "Merchants verifying BOA transfers at checkout",
      "Businesses reconciling BOA deposits",
      "Apps integrating BOA payment verification",
      "Finance teams auditing BOA transactions",
    ],
    faq: [
      {
        q: "Does BOA verification require Selenium or a headless browser?",
        a: "No. Unlike the ethiobank_receipts library which requires Chrome WebDriver for BOA, cheki uses BOA's JSON API directly. This is faster, lighter, and works in serverless environments without browser dependencies.",
      },
      {
        q: "What information do I need to verify a BOA transaction?",
        a: "You need the transaction reference number from the receipt and the last 5 digits of the receiving account number. cheki combines these to construct the BOA API URL.",
      },
      {
        q: "Is the BOA receipt endpoint public?",
        a: "Yes. The BOA online slip API at cs.bankofabyssinia.com is publicly accessible without authentication. check.et and verify.et charge you for calling this same endpoint.",
      },
    ],
    seo: {
      title: "Verify Bank of Abyssinia Transactions Online",
      description:
        "Verify Bank of Abyssinia (BOA) transactions for free. Check transaction references against official BOA API endpoints. No Selenium, no signup, no API key.",
      keywords: [
        "BOA receipt verification",
        "verify Bank of Abyssinia transaction",
        "BOA payment check",
        "Abyssinia bank receipt",
        "ethiopian bank receipt verify",
        "BOA online slip",
      ],
    },
  },
  {
    code: "mpesa",
    name: "M-Pesa Ethiopia",
    shortName: "M-Pesa",
    type: "mobile",
    requiresAccount: false,
    status: "live",
    refPattern: /^[A-Z]{2}\d{6}/i,
    refPrefixes: ["Various"],
    color: "#16a34a",
    geoBlocked: true,
    endpoint: "m-pesabusiness.safaricom.et",
    endpointFormat: "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}",
    responseType: "json",
    description:
      "M-Pesa Ethiopia is Safaricom's mobile money service operating in Ethiopia. M-Pesa receipts are available via a public JSON API that returns structured transaction data. The endpoint is geo-blocked to Ethiopian IP addresses, similar to Telebirr.",
    referenceFormat: "Alphanumeric reference (typically 2 letters followed by 6+ digits)",
    referenceExample: "SE12345678",
    howToVerify: [
      "Get the transaction reference from the customer's M-Pesa SMS or receipt",
      "cheki calls M-Pesa's public JSON API and extracts payment data",
      "If the server can't reach M-Pesa (geo-block), cheki provides a direct receipt URL",
    ],
    useCases: [
      "Shops confirming M-Pesa payments",
      "Online stores verifying M-Pesa transactions",
      "Businesses reconciling M-Pesa deposits",
      "Developers integrating M-Pesa verification via API",
    ],
    faq: [
      {
        q: "Why does M-Pesa verification fail from outside Ethiopia?",
        a: "M-Pesa's receipt API (m-pesabusiness.safaricom.et) blocks requests from non-Ethiopian IP addresses. cheki provides a fallback URL so users on Ethiopian networks can verify directly.",
      },
      {
        q: "Is M-Pesa receipt verification free?",
        a: "Yes. The M-Pesa receipt API is public and returns JSON data. check.et and verify.et charge for accessing this same endpoint. cheki does it for free.",
      },
      {
        q: "What information do I need to verify an M-Pesa transaction?",
        a: "Only the transaction reference number (trxNo). Unlike CBE and BOA, M-Pesa does not require an account number for receipt verification.",
      },
    ],
    seo: {
      title: "Verify M-Pesa Ethiopia Transactions Online",
      description:
        "Verify M-Pesa Ethiopia (Safaricom) transactions for free. Check transaction references against official M-Pesa receipt API. No signup, no API key.",
      keywords: [
        "M-Pesa receipt verification",
        "verify M-Pesa Ethiopia transaction",
        "Safaricom Ethiopia receipt",
        "M-Pesa payment check",
        "ethiopian mobile money verification",
      ],
    },
  },
  {
    code: "dashen",
    name: "Dashen Bank",
    shortName: "Dashen",
    type: "bank",
    requiresAccount: false,
    status: "live",
    color: "#dc2626",
    endpoint: "receipt.dashensuperapp.com",
    endpointFormat: "https://receipt.dashensuperapp.com/receipt/{REFERENCE}",
    responseType: "pdf",
    description:
      "Dashen Bank publishes transaction receipts as public PDF documents. The URL works for both within-Dashen and Other Bank Transfer (inter-bank) receipts. Only the FT Ref / Transaction Reference is needed.",
    referenceFormat: "Alphanumeric Dashen transaction reference (FT Ref / Transaction Reference on the receipt). Do not use the Transfer Reference.",
    referenceExample: "B22WDTI261620001 or D31OBTI251720001",
    howToVerify: [
      "Get the FT Ref / Transaction Reference from the customer's Dashen receipt",
      "cheki fetches the official PDF from receipt.dashensuperapp.com",
      "Payment data is extracted from the PDF and returned as structured JSON",
    ],
    useCases: [
      "Merchants verifying Dashen transfers",
      "Businesses reconciling Dashen deposits",
      "Apps integrating Dashen payment verification",
    ],
    faq: [
      {
        q: "Does Dashen verification require an account number?",
        a: "No. Dashen's receipt URL only requires the transaction reference number. Use the FT Ref (also labeled Transaction Reference), which looks like B22WDTI... or D31OBTI...",
      },
      {
        q: "What is the difference between FT Ref and Transaction Ref?",
        a: "Use the FT Ref (also labeled Transaction Reference). It looks like B22WDTI... or D31OBTI... The Transfer Reference is an external network tracking number and does not fetch a PDF from Dashen's API.",
      },
      {
        q: "Does Dashen verification work for inter-bank transfers?",
        a: "Yes. The updated endpoint works for both within-Dashen and Other Bank Transfer (inter-bank) receipts.",
      },
    ],
    seo: {
      title: "Verify Dashen Bank Transactions Online",
      description:
        "Verify Dashen Bank transactions for free. Check transaction references against official Dashen receipt endpoints. Works for within-Dashen and inter-bank transfers. No signup, no API key.",
      keywords: [
        "Dashen Bank receipt verification",
        "verify Dashen transaction",
        "Dashen payment check",
        "ethiopian bank receipt verify",
      ],
    },
  },
  {
    code: "awash",
    name: "Awash Bank",
    shortName: "Awash",
    type: "bank",
    requiresAccount: false,
    status: "soon",
    color: "#f59e0b",
    endpoint: "awashpay.awashbank.com:8225",
    endpointFormat: "https://awashpay.awashbank.com:8225/-{REFERENCE}",
    responseType: "html",
    description:
      "Awash Bank receipts are published by a Servicecops app. The endpoint is known but the correct receipt reference format is not yet confirmed for the visible transaction ID.",
    referenceFormat: "Unknown — the visible transaction ID does not work with the known endpoint. A share link from the Awash app is needed.",
    referenceExample: "260328171079006 (does not work with current endpoint)",
    howToVerify: [
      "Get the correct receipt reference from the Awash app share link",
      "cheki will fetch the receipt from Awash's public endpoint",
      "Payment data will be extracted from the HTML and returned as structured JSON",
    ],
    useCases: [
      "Merchants verifying Awash transfers",
      "Businesses reconciling Awash deposits",
    ],
    faq: [
      {
        q: "When will Awash verification be available?",
        a: "Awash verification is in development. The known endpoint (awashpay.awashbank.com:8225/-{ref}) returns 'Invalid receipt id' for the visible transaction ID. We need a valid share link from the Awash app to determine the correct reference format.",
      },
    ],
    seo: {
      title: "Verify Awash Bank Transactions Online",
      description:
        "Verify Awash Bank transactions for free. Check transaction references against official Awash receipt endpoints. No signup, no API key.",
      keywords: [
        "Awash Bank receipt verification",
        "verify Awash transaction",
        "Awash payment check",
        "ethiopian bank receipt verify",
      ],
    },
  },
  {
    code: "zemen",
    name: "Zemen Bank",
    shortName: "Zemen",
    type: "bank",
    requiresAccount: false,
    status: "live",
    color: "#2563eb",
    endpoint: "share.zemenbank.com",
    endpointFormat: "https://share.zemenbank.com/rt/{REFERENCE}/pdf",
    responseType: "pdf",
    description:
      "Zemen Bank is an Ethiopian commercial bank. Zemen receipts are published as PDF documents accessible via a public URL containing the transaction reference.",
    referenceFormat: "Alphanumeric transaction reference",
    referenceExample: "ZM12345678",
    howToVerify: [
      "Get the transaction reference from the customer's Zemen receipt",
      "cheki fetches the receipt PDF from Zemen's public endpoint",
      "Payment data is extracted from the PDF and returned as structured JSON",
    ],
    useCases: [
      "Merchants verifying Zemen transfers",
      "Businesses reconciling Zemen deposits",
      "Apps integrating Zemen payment verification",
    ],
    faq: [
      {
        q: "When will Zemen verification be available?",
        a: "Zemen verification is in development. The public endpoint is known and the parser is being built. Follow the GitHub repository for updates.",
      },
    ],
    seo: {
      title: "Verify Zemen Bank Transactions Online",
      description:
        "Verify Zemen Bank transactions for free. Check transaction references against official Zemen receipt endpoints. No signup, no API key.",
      keywords: [
        "Zemen Bank receipt verification",
        "verify Zemen transaction",
        "Zemen payment check",
        "ethiopian bank receipt verify",
      ],
    },
  },
  {
    code: "cbebirr",
    name: "CBE Birr",
    shortName: "CBE Birr",
    type: "wallet",
    requiresAccount: false,
    requiresPhone: true,
    status: "live",
    color: "#0ea5e9",
    endpoint: "apps.cbebirr.com.et",
    endpointFormat: "https://apps.cbebirr.com.et/receipt/{REFERENCE}?phone={PAYER_PHONE}",
    responseType: "html",
    description:
      "CBE Birr is the Commercial Bank of Ethiopia's mobile wallet service. CBE Birr receipts require the transaction reference and the payer's phone number for verification.",
    referenceFormat: "Alphanumeric transaction reference",
    referenceExample: "CB12345678",
    howToVerify: [
      "Get the transaction reference from the customer's CBE Birr receipt",
      "Get the payer's phone number (format: 2519XXXXXXXXX)",
      "cheki fetches the receipt from CBE Birr's public endpoint",
    ],
    useCases: [
      "Merchants verifying CBE Birr payments",
      "Businesses reconciling CBE Birr deposits",
      "Apps integrating CBE Birr payment verification",
    ],
    faq: [
      {
        q: "When will CBE Birr verification be available?",
        a: "CBE Birr verification is in development. The public endpoint requires the payer's phone number in addition to the transaction reference. Follow the GitHub repository for updates.",
      },
      {
        q: "Why does CBE Birr need a phone number?",
        a: "CBE Birr's receipt endpoint requires the payer's phone number as an additional verification factor. This prevents unauthorized receipt enumeration.",
      },
    ],
    seo: {
      title: "Verify CBE Birr Transactions Online",
      description:
        "Verify CBE Birr transactions for free. Check transaction references against official CBE Birr receipt endpoints. No signup, no API key.",
      keywords: [
        "CBE Birr receipt verification",
        "verify CBE Birr transaction",
        "CBE Birr payment check",
        "ethiopian mobile wallet verify",
      ],
    },
  },
  {
    code: "siinqee",
    name: "Siinqee Bank",
    shortName: "Siinqee",
    type: "bank",
    requiresAccount: false,
    status: "live",
    color: "#be185d",
    endpoint: "siinqeebank.com",
    endpointFormat: "https://siinqeebank.com/receipt/{REFERENCE}",
    responseType: "html",
    description:
      "Siinqee Bank is an Ethiopian microfinance institution turned bank. Siinqee receipts are available via a public endpoint.",
    referenceFormat: "Alphanumeric transaction reference",
    referenceExample: "SQ12345678",
    howToVerify: [
      "Get the transaction reference from the customer's Siinqee receipt",
      "cheki fetches the receipt from Siinqee's public endpoint",
    ],
    useCases: [
      "Merchants verifying Siinqee transfers",
      "Businesses reconciling Siinqee deposits",
    ],
    faq: [
      {
        q: "When will Siinqee verification be available?",
        a: "Siinqee verification is in development. Follow the GitHub repository for updates.",
      },
    ],
    seo: {
      title: "Verify Siinqee Bank Transactions Online",
      description:
        "Verify Siinqee Bank transactions for free. No signup, no API key.",
      keywords: [
        "Siinqee Bank receipt verification",
        "verify Siinqee transaction",
        "ethiopian bank receipt verify",
      ],
    },
  },
];

export type BankCode = (typeof banks)[number]["code"];

export function getBank(code: string): Bank | undefined {
  return banks.find((b) => b.code === code);
}

export function detectBank(reference: string): string | null {
  const upper = reference.toUpperCase().trim();
  for (const b of banks) {
    if (b.refPattern) {
      try {
        if (b.refPattern.test(upper)) return b.code;
      } catch {}
    }
  }
  // Fallback: check prefixes manually
  if (upper.startsWith("FT")) return "cbe";
  if (/^(DET|CHQ|DAB|DEL|ADQ|DEP|CHG)/i.test(upper)) return "telebirr";
  return null;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  fallbackUrl?: string;
  bank?: string;
  reference?: string;
  sourceUrl?: string;
  verified?: boolean;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  branch?: string;
  reason?: string;
  raw?: string;
  // Telebirr / wallet-specific
  invoiceNumber?: string;
  transactionStatus?: string;
  settledAmount?: number;
  stampDuty?: number;
  discountAmount?: number;
  serviceFee?: number;
  serviceFeeVat?: number;
  totalPaid?: number;
  amountInWords?: string;
  paymentMode?: string;
  paymentChannel?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}
