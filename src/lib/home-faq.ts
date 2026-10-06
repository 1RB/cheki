/**
 * The five questions the homepage actually answers on the page.
 *
 * One source of truth: the same objects drive the visible FAQ block and the
 * FAQPage JSON-LD. Google requires the marked-up questions to appear in the
 * visible content, so they cannot drift apart.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const homeFaqs: FaqItem[] = [
  {
    q: "Is cheki really free?",
    a: "Yes. cheki is 100% free with no limits — no signup, no API key, no credit card, and no verification quota. check.et charges 499 ETB/month after 200 verifications and verify.et charges $20-40/month. cheki is MIT licensed, so you can also read the source and self-host it.",
  },
  {
    q: "How does receipt verification work?",
    a: "Every Ethiopian bank and mobile wallet publishes transaction receipts at publicly accessible URLs, and those URLs require no authentication. cheki fetches the URL, parses the response (PDF, HTML, or JSON), and returns clean structured JSON with sender, receiver, amount, date, and reference number — plus the source URL it came from.",
  },
  {
    q: "Which banks are supported?",
    a: "cheki supports 10 live banks and wallets: CBE, Telebirr, Bank of Abyssinia, M-Pesa, Dashen Bank, Awash Bank, Zemen Bank, CBE Birr, Siinqee Bank, and eBirr. Others are in research and anyone can contribute one — the endpoint formats live in a single file in the repo.",
  },
  {
    q: "Do I need an API key?",
    a: "No. cheki's API requires no authentication at all: no API key, no bearer token, no OAuth. Just POST to /api/verify with a JSON body containing the bank code, the reference number, and for some banks the account number.",
  },
  {
    q: "Can I self-host cheki?",
    a: "Yes. cheki is MIT licensed and ships with Docker support — clone the repo, run docker-compose up, and the API is live on localhost:3000. Self-hosting from an Ethiopian IP also bypasses geo-blocks on the Telebirr and M-Pesa endpoints.",
  },
];
