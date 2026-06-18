export interface Guide {
  slug: string;
  title: string;
  description: string;
  category: "bank" | "fraud" | "business" | "api" | "comparison";
  bankCode?: string;
  excerpt: string;
  content: GuideSection[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  faq?: { q: string; a: string }[];
  relatedGuides?: string[];
}

export interface GuideSection {
  heading: string;
  body: string[];
  list?: string[];
}

export const guides: Guide[] = [
  {
    slug: "verify-cbe-transactions",
    title: "How to Verify Commercial Bank of Ethiopia Transactions",
    description:
      "Step-by-step guide to verifying CBE (Commercial Bank of Ethiopia) transactions using FT reference numbers and account details. Free verification with cheki.",
    category: "bank",
    bankCode: "cbe",
    excerpt:
      "CBE is the most common settlement rail for Ethiopian businesses. Learn how to verify any CBE transfer for free using the FT reference and account number.",
    content: [
      {
        heading: "What you need to verify a CBE transaction",
        body: [
          "To verify a Commercial Bank of Ethiopia (CBE) transaction, you need two pieces of information from the receipt:",
        ],
        list: [
          "FT transaction reference number (required) — e.g. FT26140P01YB. This is a unique identifier that starts with FT followed by 10 alphanumeric characters.",
          "Receiving CBE account number (required) — e.g. 1000213429489. cheki only needs the last 8 digits to construct the receipt URL.",
        ],
      },
      {
        heading: "How CBE receipt verification works",
        body: [
          "CBE publishes every transaction receipt as a PDF document at a public URL. The URL is constructed by combining the FT reference number with the last 8 digits of the receiving account number.",
          "The full URL format is: https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS}",
          "For example, if the FT reference is FT26140P01YB and the receiving account is 1000560536171, the URL would be: https://apps.cbe.com.et:100/?id=FT26140P01YB60536171",
          "This URL returns an official CBE PDF receipt containing the sender name, receiver name, amount, date, branch, and transaction reference. cheki fetches this PDF, extracts the data, and returns it as structured JSON.",
        ],
      },
      {
        heading: "Step-by-step: Verify a CBE transaction with cheki",
        body: ["Verifying a CBE transaction with cheki takes less than 5 seconds:"],
        list: [
          "Go to cheki.app and select CBE from the bank dropdown (or just paste an FT reference — cheki auto-detects CBE)",
          "Enter the FT reference number from the customer's receipt",
          "Enter the last 8 digits of your receiving CBE account number",
          "Click Verify — cheki fetches the official CBE PDF and extracts payment data",
          "Review the result: sender name, receiver name, amount, date, and branch are all displayed",
        ],
      },
      {
        heading: "Who uses CBE verification",
        body: [
          "CBE verification is used across industries in Ethiopia:",
        ],
        list: [
          "Retail counters confirming in-person CBE transfers before releasing goods",
          "Delivery teams validating payment before handover",
          "Finance teams reconciling daily CBE inflows against bank statements",
          "Developers automating CBE checks through the cheki REST API",
          "E-commerce platforms verifying CBE payments before order fulfillment",
        ],
      },
      {
        heading: "Why automate CBE verification",
        body: [
          "Manual screenshot checks are slow and error-prone. Customers can edit screenshots, reuse old receipts, or send fake transfer confirmations. Automated verification with cheki:",
          "Confirms the transaction exists on CBE's official system in real time",
          "Extracts the exact amount, sender, and date from the PDF",
          "Eliminates disputes caused by manual checking",
          "Scales across branches and employees with no per-person cost",
        ],
      },
      {
        heading: "Verifying CBE transactions via API",
        body: [
          "cheki provides a free REST API for CBE verification. No API key required.",
          "POST https://cheki.app/api/verify with body: { \"bank\": \"cbe\", \"reference\": \"FT26140P01YB\", \"accountNumber\": \"1000560536171\" }",
          "The response includes the verified transaction data as structured JSON. See the API docs for full details.",
        ],
      },
    ],
    faq: [
      {
        q: "What is a CBE FT reference number?",
        a: "The FT reference is a unique transaction identifier assigned by CBE to every transfer. It starts with FT followed by 10 alphanumeric characters, such as FT26140P01YB. It appears on the customer's receipt and in their banking app transaction history.",
      },
      {
        q: "Can I verify CBE with only the reference number?",
        a: "No. CBE's public receipt endpoint requires both the FT reference and the last 8 digits of the receiving account number. This prevents unauthorized receipt enumeration. cheki asks for both fields when CBE is selected.",
      },
      {
        q: "Does CBE charge for receipt verification?",
        a: "No. The CBE receipt endpoint is a public URL that returns a PDF for free. check.et and verify.et charge you for hitting this same URL. cheki does it for free.",
      },
      {
        q: "How fast is CBE verification?",
        a: "CBE verification typically completes in 1-3 seconds. cheki fetches the PDF from CBE's server and extracts the data in real time.",
      },
    ],
    relatedGuides: ["verify-telebirr-transactions", "prevent-fake-payment-screenshots", "cbe-fake-receipt"],
    seo: {
      title: "How to Verify CBE Transactions in Ethiopia | cheki",
      description:
        "Step-by-step guide to verifying Commercial Bank of Ethiopia (CBE) transactions using FT reference numbers. Free verification with cheki.",
      keywords: [
        "verify CBE transaction",
        "CBE FT reference",
        "CBE receipt verification",
        "how to verify CBE transfer",
        "Commercial Bank of Ethiopia verify",
      ],
    },
  },
  {
    slug: "verify-telebirr-transactions",
    title: "How to Verify Telebirr Transactions",
    description:
      "Step-by-step guide to verifying Telebirr (Ethio Telecom) transactions using transaction reference numbers. Free verification with cheki.",
    category: "bank",
    bankCode: "telebirr",
    excerpt:
      "Telebirr is Ethiopia's most used mobile wallet. Learn how to verify any Telebirr transaction for free using the transaction reference.",
    content: [
      {
        heading: "What you need to verify a Telebirr transaction",
        body: [
          "To verify a Telebirr transaction, you only need one piece of information:",
        ],
        list: [
          "Transaction reference number (required) — e.g. DET8FJGUJ4 or CHQ0FJ403O. This is sent via SMS to both the payer and receiver after each transaction.",
        ],
      },
      {
        heading: "How Telebirr receipt verification works",
        body: [
          "Telebirr publishes every transaction receipt as an HTML page at a public URL. The URL is constructed using only the transaction reference number.",
          "The URL format is: https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}",
          "For example, if the reference is DET8FJGUJ4, the URL would be: https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4",
          "This URL returns an official Telebirr receipt page containing the payer name, receiver name, amount, date, and transaction status. cheki fetches this page, extracts the data, and returns it as structured JSON.",
        ],
      },
      {
        heading: "Geo-blocking: Telebirr and non-Ethiopian IPs",
        body: [
          "Telebirr's receipt endpoint blocks requests from IP addresses outside Ethiopia. This is a network-level restriction imposed by Ethio Telecom.",
          "If cheki's server cannot reach Telebirr (because it runs on a cloud provider with a non-Ethiopian IP), cheki returns a fallback URL. The user can click 'Open Receipt' to open the Telebirr receipt directly in their browser, which uses their own Ethiopian IP address.",
          "For server-side verification from outside Ethiopia, you can self-host cheki on an Ethiopian server or use the X-Forwarded-For header with an Ethiopian IP from a residential connection.",
        ],
      },
      {
        heading: "Step-by-step: Verify a Telebirr transaction",
        body: ["Verifying a Telebirr transaction with cheki is simple:"],
        list: [
          "Go to cheki.app and paste the transaction reference (cheki auto-detects Telebirr from the prefix)",
          "Click Verify — cheki fetches the official Telebirr receipt",
          "Review the result: payer name, receiver name, amount, and date are displayed",
          "If the server is geo-blocked, click 'Open Receipt' to verify directly in your browser",
        ],
      },
      {
        heading: "Common Telebirr reference prefixes",
        body: [
          "Telebirr transaction references start with a 2-3 letter prefix. Common prefixes include:",
        ],
        list: [
          "DET — most common for person-to-person transfers",
          "CHQ — cheque-related transactions",
          "DAB — bank account transfers",
          "DEL — merchant payments",
          "ADQ — additional transaction types",
        ],
      },
      {
        heading: "Who uses Telebirr verification",
        body: ["Telebirr verification is critical for:"],
        list: [
          "Shops confirming Telebirr payments at the counter before releasing goods",
          "Online stores verifying Telebirr payments before order fulfillment",
          "Delivery services validating payment before handover",
          "Marketplaces integrating Telebirr verification via API",
          "Logistics companies confirming payment before dispatch",
        ],
      },
    ],
    faq: [
      {
        q: "What does a Telebirr reference number look like?",
        a: "Telebirr references start with a 2-3 letter prefix (DET, CHQ, DAB, DEL, ADQ) followed by 6-8 alphanumeric characters. The full reference is sent via SMS to both payer and receiver.",
      },
      {
        q: "Why does Telebirr verification fail from outside Ethiopia?",
        a: "Telebirr's receipt endpoint blocks non-Ethiopian IPs. cheki provides a fallback URL so users on Ethiopian networks can verify directly. Self-hosting on an Ethiopian server bypasses this restriction.",
      },
      {
        q: "Do I need an account number to verify Telebirr?",
        a: "No. Telebirr verification only requires the transaction reference number. This makes it simpler than CBE or BOA verification.",
      },
      {
        q: "Is Telebirr receipt verification free?",
        a: "Yes. The Telebirr receipt URL is public and free. check.et charges 499 ETB/month for accessing this same endpoint. cheki does it for free.",
      },
    ],
    relatedGuides: ["verify-cbe-transactions", "prevent-fake-payment-screenshots", "telebirr-vs-cbe"],
    seo: {
      title: "How to Verify Telebirr Transactions in Ethiopia | cheki",
      description:
        "Step-by-step guide to verifying Telebirr transactions using reference numbers. Free verification with cheki. Handle geo-blocking easily.",
      keywords: [
        "verify telebirr transaction",
        "telebirr receipt verification",
        "how to verify telebirr transfer",
        "telebirr transaction ID format",
        "ethio telecom receipt verify",
      ],
    },
  },
  {
    slug: "prevent-fake-payment-screenshots",
    title: "How to Prevent Fake Payment Screenshots in Ethiopia",
    description:
      "Learn how Ethiopian merchants detect forged Telebirr, CBE, and bank transfer screenshots. Verification checklist and tools to stop payment fraud.",
    category: "fraud",
    excerpt:
      "Fake payment screenshots cost Ethiopian businesses millions. Learn how to detect forged receipts and verify every payment for free.",
    content: [
      {
        heading: "The fake screenshot problem",
        body: [
          "Fake payment screenshots are one of the most common fraud tactics in Ethiopia. Customers edit screenshots of Telebirr, CBE, or other bank transfer confirmations to show a payment that never happened. The merchant releases goods, then discovers the transfer was fake.",
          "This costs Ethiopian businesses millions of birr every year. The solution is simple: never trust a screenshot. Always verify against the bank's official system.",
        ],
      },
      {
        heading: "How fake screenshots are made",
        body: [
          "Fraudsters use several methods to create fake payment confirmations:",
        ],
        list: [
          "Editing the amount in a screenshot using photo editing apps",
          "Reusing an old receipt screenshot for a new transaction",
          "Sending a screenshot of a transfer to a different account",
          "Modifying the date and time on an old receipt",
          "Creating a completely fabricated receipt that looks like the real app",
        ],
      },
      {
        heading: "How to detect fake screenshots",
        body: [
          "The only reliable way to detect a fake screenshot is to verify the transaction against the bank's official system. cheki does this automatically:",
        ],
        list: [
          "cheki fetches the receipt from the bank's public endpoint using the transaction reference",
          "If the transaction exists, cheki returns the official data including amount, sender, and date",
          "If the transaction does not exist, the bank returns a 404 or error — the screenshot is fake",
          "cheki also shows the source URL so you can verify the data came from the bank directly",
        ],
      },
      {
        heading: "Verification checklist for merchants",
        body: ["Before releasing goods or services, follow this checklist:"],
        list: [
          "Ask the customer for the transaction reference number (not just a screenshot)",
          "Enter the reference in cheki.app or call the cheki API",
          "Verify the amount matches what the customer owes you",
          "Verify the receiver name matches your business name",
          "Verify the date and time are recent (within the last few minutes)",
          "If verification fails, do not release goods — ask the customer to retry the payment",
        ],
      },
      {
        heading: "Why manual checking fails",
        body: [
          "Manual screenshot checking is unreliable because:",
          "Fake screenshots can look identical to real ones — the human eye cannot detect well-edited images",
          "Staff under pressure at busy counters may skip verification steps",
          "Old receipts can be reused — the same screenshot can be sent to multiple merchants",
          "There is no way to manually verify a transaction without contacting the bank or using an automated tool",
        ],
      },
      {
        heading: "Automate fraud prevention with cheki",
        body: [
          "cheki automates the entire verification process. Instead of manually checking screenshots, integrate cheki into your workflow:",
          "Use the web interface at cheki.app for one-off verifications",
          "Use the free REST API for automated verification in your app or POS system",
          "Use the batch verification endpoint to verify up to 50 receipts at once",
          "Use the Python library for server-side verification from Ethiopian networks",
        ],
      },
    ],
    faq: [
      {
        q: "Can I detect a fake screenshot just by looking at it?",
        a: "No. Well-edited fake screenshots can look identical to real ones. The only reliable detection method is to verify the transaction reference against the bank's official system using cheki.",
      },
      {
        q: "What should I do if a customer's transaction doesn't verify?",
        a: "Do not release goods or services. Ask the customer to check their banking app and retry the payment. If they insist they paid, ask them to show the live transaction in their app (not a screenshot).",
      },
      {
        q: "How much does fake receipt fraud cost Ethiopian businesses?",
        a: "While exact figures are not publicly available, fake receipt fraud is widely reported across Ethiopian retail, delivery, and e-commerce. Each fraudulent transaction can cost anywhere from hundreds to tens of thousands of birr.",
      },
    ],
    relatedGuides: ["cbe-fake-receipt", "detect-duplicate-payment-fraud", "verify-cbe-transactions"],
    seo: {
      title: "How to Prevent Fake Payment Screenshots in Ethiopia | cheki",
      description:
        "Learn how Ethiopian merchants detect forged Telebirr, CBE, and bank transfer screenshots. Free verification tools to stop payment fraud.",
      keywords: [
        "fake payment screenshot Ethiopia",
        "fake telebirr receipt",
        "fake CBE transfer",
        "payment fraud prevention Ethiopia",
        "detect fake receipt",
      ],
    },
  },
  {
    slug: "cbe-fake-receipt",
    title: "CBE Fake Receipt: How to Spot and Stop Them",
    description:
      "Protect your business from fake CBE transfer screenshots in Ethiopia. Learn how forged receipts look, common patterns, and how live verification catches them.",
    category: "fraud",
    excerpt:
      "CBE is the most commonly faked receipt in Ethiopia. Learn the patterns fraudsters use and how to catch them instantly with live verification.",
    content: [
      {
        heading: "Why CBE receipts are faked",
        body: [
          "CBE (Commercial Bank of Ethiopia) is the largest bank in Ethiopia and the most common settlement rail for businesses. This makes CBE receipts the most frequent target for fraudsters.",
          "Fake CBE receipts typically involve editing a real receipt screenshot to change the amount, date, or reference number. The fraudster then presents the fake screenshot to a merchant who releases goods without verifying.",
        ],
      },
      {
        heading: "Common CBE fake receipt patterns",
        body: ["Fraudsters use several patterns to create fake CBE receipts:"],
        list: [
          "Editing the amount field in a real CBE receipt screenshot — changing 1,000 ETB to 10,000 ETB",
          "Reusing an old receipt from a previous genuine transaction",
          "Creating a screenshot that shows a transfer to a different account than the merchant's",
          "Modifying the FT reference number to match a different transaction",
          "Sending a receipt from a different bank that looks similar to CBE",
        ],
      },
      {
        heading: "How live verification catches fake CBE receipts",
        body: [
          "Live verification with cheki is the only reliable way to detect fake CBE receipts. Here's how it works:",
          "cheki takes the FT reference number and the last 8 digits of your receiving account, then fetches the official CBE PDF receipt from apps.cbe.com.et:100",
          "If the transaction is real, the PDF contains the actual amount, sender name, and date — which you can compare against what the customer claimed",
          "If the transaction is fake (edited reference, wrong account, or fabricated), the CBE endpoint returns a 404 or an empty response",
          "cheki displays the official data side-by-side with the source URL, so you can confirm the data came directly from CBE",
        ],
      },
      {
        heading: "Step-by-step: Verify a CBE receipt",
        body: ["To verify a CBE receipt and detect fakes:"],
        list: [
          "Get the FT reference number from the customer (starts with FT, e.g. FT26140P01YB)",
          "Get the last 8 digits of your receiving CBE account number",
          "Enter both in cheki.app or call the API",
          "Check the returned amount matches what the customer owes",
          "Check the returned receiver name matches your business",
          "Check the returned date is recent",
          "If any field doesn't match or the receipt doesn't exist, the screenshot is fake",
        ],
      },
      {
        heading: "What to do when you catch a fake receipt",
        body: [
          "If verification fails or the data doesn't match:",
          "Do not release goods or services under any circumstances",
          "Politely inform the customer that the transaction could not be verified",
          "Ask them to check their CBE app and ensure the transfer was completed",
          "If they insist, ask them to show the live transaction in their CBE app (not a screenshot)",
          "Report repeat offenders to your business association or local authorities",
        ],
      },
    ],
    faq: [
      {
        q: "Can a fraudster fake the CBE receipt PDF?",
        a: "No. The PDF is generated by CBE's server and cannot be faked. cheki fetches the PDF directly from CBE's official endpoint. A fraudster would need to hack CBE's servers to forge a PDF, which is extremely unlikely.",
      },
      {
        q: "What if the FT reference is real but the amount is different?",
        a: "cheki returns the official amount from the CBE PDF. If the amount on the receipt doesn't match what the customer claimed they paid, the customer may have sent a smaller amount or the screenshot was edited.",
      },
      {
        q: "How fast is CBE fake receipt detection?",
        a: "CBE verification with cheki takes 1-3 seconds. This is fast enough to verify every transaction at the counter without slowing down operations.",
      },
    ],
    relatedGuides: ["prevent-fake-payment-screenshots", "detect-duplicate-payment-fraud", "verify-cbe-transactions"],
    seo: {
      title: "CBE Fake Receipt: How to Spot and Stop Them | cheki",
      description:
        "Protect your business from fake CBE transfer screenshots. Learn how forged receipts look and how live verification catches them instantly.",
      keywords: [
        "fake CBE receipt",
        "CBE fake transfer screenshot",
        "detect fake CBE receipt",
        "CBE receipt fraud Ethiopia",
        "CBE FT reference fake",
      ],
    },
  },
  {
    slug: "detect-duplicate-payment-fraud",
    title: "How to Detect Duplicate Payment Fraud in Ethiopia",
    description:
      "Learn how to identify and stop duplicate payment fraud in Ethiopia. Spot reused Telebirr and CBE receipts before releasing goods or services.",
    category: "fraud",
    excerpt:
      "Duplicate receipt fraud is when a customer reuses an old receipt for a new purchase. Learn how to detect and prevent it.",
    content: [
      {
        heading: "What is duplicate payment fraud?",
        body: [
          "Duplicate payment fraud is when a customer uses a receipt from a previous genuine transaction to trick a merchant into releasing goods for a new purchase. The receipt is real — it was a genuine payment — but it was made days or weeks ago for a different purchase.",
          "This is one of the hardest fraud types to detect manually because the receipt is legitimate. The only way to catch it is to track which receipts have already been used.",
        ],
      },
      {
        heading: "How duplicate fraud works",
        body: ["A typical duplicate fraud scenario:"],
        list: [
          "A customer makes a genuine 5,000 ETB payment to your business and receives a receipt",
          "A week later, they come back and present the same receipt for a new 5,000 ETB purchase",
          "If you don't track receipts, you might accept it and release goods",
          "You've now given away 5,000 ETB worth of goods for free",
        ],
      },
      {
        heading: "How to prevent duplicate fraud",
        body: [
          "The solution is to track every verified receipt. cheki's API and batch verification endpoint make this easy:",
          "When you verify a receipt, store the transaction reference in your system",
          "Before accepting a payment, check if the reference has already been used",
          "cheki's API returns the transaction date, so you can also check if the payment was made recently (within the last hour, for example)",
          "For businesses with multiple branches, use a shared database to track receipts across all locations",
        ],
      },
      {
        heading: "Using cheki's batch verification for fraud detection",
        body: [
          "cheki's batch verification endpoint allows you to verify up to 50 receipts at once. This is useful for end-of-day reconciliation:",
          "POST https://cheki.app/api/verify/batch with an array of receipts",
          "The response includes verification status for each receipt",
          "Compare the results against your sales records to identify any duplicates",
        ],
      },
    ],
    faq: [
      {
        q: "How do I know if a receipt has been used before?",
        a: "Track every verified transaction reference in your system. Before accepting a payment, check if the reference already exists in your records. cheki's API makes this easy to automate.",
      },
      {
        q: "Can check.et detect duplicate receipts?",
        a: "Yes, check.et has built-in duplicate detection. But it charges 499 ETB/month for this feature. cheki provides the same capability for free via the API — you just need to store the references in your own database.",
      },
      {
        q: "Should I reject old receipts?",
        a: "Yes. Set a time window for acceptable receipts (e.g. 1 hour). If a receipt's transaction date is older than your window, reject it. This prevents both duplicate fraud and stale payments.",
      },
    ],
    relatedGuides: ["prevent-fake-payment-screenshots", "cbe-fake-receipt", "payment-verification-businesses"],
    seo: {
      title: "How to Detect Duplicate Payment Fraud in Ethiopia | cheki",
      description:
        "Learn how to identify and stop duplicate payment fraud in Ethiopia. Spot reused Telebirr and CBE receipts before releasing goods.",
      keywords: [
        "duplicate payment fraud Ethiopia",
        "reused receipt fraud",
        "duplicate receipt detection",
        "payment fraud prevention",
      ],
    },
  },
  {
    slug: "payment-verification-businesses",
    title: "Payment Verification for Ethiopian Businesses",
    description:
      "Why Ethiopian shops, logistics, and SaaS teams centralize CBE, Telebirr, and bank verification. Team workspaces, API, and audit history explained.",
    category: "business",
    excerpt:
      "From single shops to multi-branch businesses, learn why centralized payment verification is essential for Ethiopian commerce.",
    content: [
      {
        heading: "Why businesses need payment verification",
        body: [
          "Ethiopian businesses face a unique payment landscape. Most transactions happen through bank transfers (CBE, BOA, Dashen) and mobile money (Telebirr, M-Pesa, CBE Birr). Unlike card payments, these transfers don't have automatic merchant confirmation.",
          "This means businesses must manually verify every payment before releasing goods or services. Without verification, businesses are vulnerable to fake screenshots, duplicate receipts, and payment disputes.",
        ],
      },
      {
        heading: "The cost of manual verification",
        body: [
          "Manual verification — asking staff to visually inspect screenshots — has several costs:",
        ],
        list: [
          "Time: Each manual check takes 30+ seconds, adding up at busy counters",
          "Errors: Staff may miss edited amounts or reused receipts",
          "Fraud: Fake screenshots can look identical to real ones",
          "Disputes: Customers may argue when staff reject their screenshots",
          "Training: New staff need to learn verification procedures",
        ],
      },
      {
        heading: "How cheki helps businesses",
        body: [
          "cheki provides free, automated payment verification that eliminates manual checking:",
          "Web interface at cheki.app for one-off verifications by staff",
          "Free REST API for integration into POS systems, e-commerce platforms, and ERPs",
          "Batch verification endpoint for processing up to 50 receipts at once",
          "Python library for server-side verification from Ethiopian networks",
          "Docker image for self-hosting on your own infrastructure",
        ],
      },
      {
        heading: "Benefits of centralized verification",
        body: [
          "Centralizing verification with cheki provides:",
        ],
        list: [
          "Consistency: Every transaction verified the same way, every time",
          "Speed: Verification completes in 1-3 seconds vs 30+ seconds manual",
          "Audit trail: API responses can be logged for reconciliation",
          "Scalability: No per-verification cost means you can verify every transaction",
          "Multi-branch: Use the same API across all locations with shared infrastructure",
        ],
      },
      {
        heading: "Getting started with cheki for your business",
        body: [
          "Getting started with cheki is free and requires no signup:",
          "1. Visit cheki.app for the web interface — no account needed",
          "2. For API integration, read the API documentation at cheki.app/docs",
          "3. For self-hosting, clone the GitHub repository and run with Docker",
          "4. For Python integration, install the library from the cheki monorepo",
        ],
      },
    ],
    faq: [
      {
        q: "How much does cheki cost for businesses?",
        a: "cheki is completely free. No signup, no API key, no per-verification cost. Unlimited verifications for unlimited users. This is in contrast to check.et which charges 499 ETB/month after 200 free verifications.",
      },
      {
        q: "Can I use cheki across multiple branches?",
        a: "Yes. cheki's API can be called from any location. For multi-branch businesses, integrate the API into your POS system and track verified receipts in a shared database.",
      },
      {
        q: "Is cheki reliable enough for business use?",
        a: "Yes. cheki fetches receipts from the same official bank endpoints that check.et and verify.et use. The data is identical. The difference is that cheki is free and open source.",
      },
    ],
    relatedGuides: ["prevent-fake-payment-screenshots", "payment-verification-api", "verify-cbe-transactions"],
    seo: {
      title: "Payment Verification for Ethiopian Businesses | cheki",
      description:
        "Why Ethiopian shops, logistics, and SaaS teams centralize CBE, Telebirr, and bank verification with cheki. Free API, batch verify, and audit trail.",
      keywords: [
        "payment verification Ethiopia business",
        "ethiopian merchant verification",
        "CBE Telebirr business verification",
        "free payment verification API",
      ],
    },
  },
  {
    slug: "payment-verification-api",
    title: "Payment Verification API for Ethiopian Businesses",
    description:
      "Integrate CBE, Telebirr, Dashen, and Awash verification into your app or ERP with the cheki REST API. Automate payment checks with one free endpoint.",
    category: "api",
    excerpt:
      "The cheki REST API lets you verify any Ethiopian bank receipt for free. No API key, no signup. Here's how to integrate it.",
    content: [
      {
        heading: "API overview",
        body: [
          "cheki provides a free REST API for verifying Ethiopian bank receipts. The API requires no authentication, no API key, and no signup. You can start making requests immediately.",
          "Base URL: https://cheki.app/api",
          "The API supports both single verification and batch verification (up to 50 receipts at once).",
        ],
      },
      {
        heading: "POST /api/verify",
        body: [
          "Verify a single receipt. Send the bank code, transaction reference, and (for CBE/BOA) the account number.",
          "Request body:",
          '{ "bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171" }',
          "Response:",
          '{ "success": true, "verified": true, "bank": "CBE", "amount": 20000, "currency": "ETB", "senderName": "Mr Mohammed Abdulwasi Reshid", "receiverName": "SAMI ADIL ZEKARIA", "date": "5/20/2026 7:29:00 PM" }',
        ],
      },
      {
        heading: "POST /api/verify/batch",
        body: [
          "Verify up to 50 receipts at once. Send an array of receipt objects.",
          "Request body:",
          '{ "receipts": [ { "bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171" }, { "bank": "telebirr", "reference": "DET8FJGUJ4" } ] }',
          "The response includes an array of results, one per receipt.",
        ],
      },
      {
        heading: "GET /api/banks",
        body: [
          "List all supported banks and their verification status. Returns bank codes, names, whether account numbers are required, and whether the bank is geo-blocked.",
        ],
      },
      {
        heading: "GET /api/health",
        body: [
          "Check the health of the API and each bank's endpoint. Returns latency in milliseconds for each bank. Use this to monitor uptime and detect issues.",
        ],
      },
      {
        heading: "Code examples",
        body: [
          "cURL:",
          "curl -X POST https://cheki.app/api/verify -H 'Content-Type: application/json' -d '{\"bank\":\"cbe\",\"reference\":\"FT26140P01YB\",\"accountNumber\":\"1000560536171\"}'",
          "",
          "JavaScript:",
          "const res = await fetch('https://cheki.app/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bank: 'cbe', reference: 'FT26140P01YB', accountNumber: '1000560536171' }) }); const data = await res.json();",
          "",
          "Python:",
          "import requests; r = requests.post('https://cheki.app/api/verify', json={'bank': 'cbe', 'reference': 'FT26140P01YB', 'accountNumber': '1000560536171'}); print(r.json())",
        ],
      },
      {
        heading: "Rate limits",
        body: [
          "cheki has no rate limits. The API is free and unlimited. However, the underlying bank endpoints may have their own rate limits. If you make too many requests too quickly, the bank may temporarily block your IP.",
          "For high-volume verification, use the batch endpoint to reduce the number of API calls.",
        ],
      },
    ],
    faq: [
      {
        q: "Do I need an API key?",
        a: "No. cheki's API requires no authentication. You can start making requests immediately without signing up or generating a key. This is different from check.et which requires a business account and API key.",
      },
      {
        q: "Is the API really free?",
        a: "Yes. cheki is open source and completely free. No trial period, no credit limit, no per-verification cost. The data comes from public bank endpoints that are free to access.",
      },
      {
        q: "What happens if the bank is geo-blocked?",
        a: "For Telebirr and M-Pesa, if cheki's server cannot reach the bank endpoint, the API returns a fallbackUrl field. You can use this URL to redirect the user's browser to the receipt page directly, which works because the user's Ethiopian IP is not blocked.",
      },
    ],
    relatedGuides: ["verify-cbe-transactions", "verify-telebirr-transactions", "payment-verification-businesses"],
    seo: {
      title: "Payment Verification API for Ethiopian Businesses | cheki",
      description:
        "Integrate CBE, Telebirr, and bank verification into your app with the cheki REST API. Free, no API key, no signup. Code examples included.",
      keywords: [
        "ethiopian payment verification API",
        "free receipt verification API",
        "CBE API verify",
        "telebirr API verify",
        "ethiopian bank API",
      ],
    },
  },
  {
    slug: "telebirr-vs-cbe",
    title: "Telebirr vs CBE Verification: What Merchants Need to Know",
    description:
      "Compare Telebirr and CBE payment verification fields, receipt formats, and best practices for Ethiopian merchants using cheki.",
    category: "comparison",
    excerpt:
      "Telebirr and CBE are the two most common payment methods in Ethiopia. Here's how their verification differs and what merchants need to know.",
    content: [
      {
        heading: "Telebirr vs CBE at a glance",
        body: [
          "Telebirr and CBE are the two most common payment methods for Ethiopian businesses. While both can be verified with cheki, their receipt formats and verification requirements are different.",
        ],
      },
      {
        heading: "Reference number format",
        body: [
          "CBE references always start with FT followed by 10 alphanumeric characters (e.g. FT26140P01YB). Telebirr references start with a 2-3 letter prefix (DET, CHQ, DAB, etc.) followed by 6-8 alphanumeric characters (e.g. DET8FJGUJ4).",
          "cheki auto-detects the bank from the reference format — you don't need to manually select the bank.",
        ],
      },
      {
        heading: "Required information",
        body: [
          "CBE verification requires the FT reference AND the last 8 digits of the receiving account number. This is a security measure by CBE to prevent receipt enumeration.",
          "Telebirr verification requires only the transaction reference number. No account number is needed.",
          "This makes Telebirr verification simpler for merchants — one field instead of two.",
        ],
      },
      {
        heading: "Receipt format",
        body: [
          "CBE receipts are published as PDF documents. cheki downloads the PDF and extracts text using pdf-parse, then parses the transaction fields with regex.",
          "Telebirr receipts are published as HTML pages. cheki fetches the HTML and extracts data using Cheerio (a server-side jQuery implementation).",
          "Both return the same structured JSON response through cheki's API, so your integration code doesn't need to handle different formats.",
        ],
      },
      {
        heading: "Geo-blocking",
        body: [
          "CBE's receipt endpoint (apps.cbe.com.et:100) is accessible from anywhere in the world. No geo-blocking.",
          "Telebirr's receipt endpoint (transactioninfo.ethiotelecom.et) is geo-blocked to Ethiopian IP addresses. If cheki's server is outside Ethiopia, Telebirr verification may fail and cheki will return a fallback URL.",
          "For businesses in Ethiopia, both work seamlessly. For businesses outside Ethiopia, CBE works globally while Telebirr requires self-hosting or the fallback URL.",
        ],
      },
      {
        heading: "Speed comparison",
        body: [
          "CBE verification typically takes 1-3 seconds (PDF download + parsing).",
          "Telebirr verification typically takes 0.5-2 seconds (HTML fetch + parsing).",
          "Both are fast enough for real-time verification at the counter.",
        ],
      },
      {
        heading: "Which should your business accept?",
        body: [
          "Most Ethiopian businesses accept both CBE and Telebirr. cheki supports both for free, so you don't need to choose. The API returns the same JSON structure regardless of which bank the customer used.",
        ],
      },
    ],
    faq: [
      {
        q: "Which is more common, Telebirr or CBE?",
        a: "Both are extremely common. CBE is the largest bank in Ethiopia with the most account holders. Telebirr is the most used mobile wallet. Most businesses accept both. cheki supports both for free.",
      },
      {
        q: "Can I verify both with one API call?",
        a: "cheki's auto-detection identifies the bank from the reference format. If you send a reference starting with FT, cheki knows it's CBE. If it starts with DET, CHQ, etc., cheki knows it's Telebirr. You can also explicitly set the bank parameter.",
      },
      {
        q: "Is one more secure than the other?",
        a: "CBE requires the account number in addition to the reference, making it harder to enumerate receipts. Telebirr only requires the reference. However, both are official bank endpoints and the data is trustworthy.",
      },
    ],
    relatedGuides: ["verify-cbe-transactions", "verify-telebirr-transactions", "prevent-fake-payment-screenshots"],
    seo: {
      title: "Telebirr vs CBE Verification: What Merchants Need to Know | cheki",
      description:
        "Compare Telebirr and CBE payment verification fields, receipt formats, and best practices for Ethiopian merchants.",
      keywords: [
        "telebirr vs CBE verification",
        "CBE telebirr comparison",
        "ethiopian payment methods comparison",
        "CBE vs telebirr receipt",
      ],
    },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}

export function getGuidesByCategory(category: Guide["category"]): Guide[] {
  return guides.filter((g) => g.category === category);
}

export function getRelatedGuides(slug: string, limit = 3): Guide[] {
  const guide = getGuide(slug);
  if (!guide || !guide.relatedGuides) return [];
  return guide.relatedGuides
    .map((s) => getGuide(s))
    .filter((g): g is Guide => g !== undefined)
    .slice(0, limit);
}
