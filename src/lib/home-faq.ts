/**
 * The questions the homepage actually answers on the page.
 *
 * One source of truth: the same objects drive the visible FAQ block and the
 * FAQPage JSON-LD. Google requires the marked-up questions to appear in the
 * visible content, so they cannot drift apart.
 */
import { LIVE_BANK_COUNT, liveBankList } from "./bank-counts";
import { RATE_LIMIT_SENTENCE, competitorPrices } from "./guides-facts";
export interface FaqItem {
  q: string;
  a: string;
}

export const homeFaqs: FaqItem[] = [
  {
    q: "Is cheki really free?",
    a: `Yes. cheki is free: no signup, no API key and no credit card. The hosted API has ${RATE_LIMIT_SENTENCE} ${competitorPrices(["check.et", "verify.et"])} cheki is MIT licensed, so you can also read the source and self-host it.`,
  },
  {
    q: "How does receipt verification work?",
    a: "Every Ethiopian bank and mobile wallet publishes transaction receipts at publicly accessible URLs, and those URLs require no authentication. cheki fetches the URL, parses the response (PDF, HTML, or JSON), and returns clean structured JSON with sender, receiver, amount, date, and reference number, plus the source URL it came from.",
  },
  {
    q: "Which banks are supported?",
    a: `cheki supports ${LIVE_BANK_COUNT} live banks and wallets: ${liveBankList()}. Others are in research and anyone can contribute one. The endpoint formats live in a single file in the repo.`,
  },
  {
    q: "Do I need an API key?",
    a: "No. cheki's API requires no authentication at all: no API key, no bearer token, no OAuth. Just POST to /api/verify with a JSON body containing the bank code, the reference number, and for some banks the account number.",
  },
  {
    q: "Can I self-host cheki?",
    a: "Yes. cheki is MIT licensed and ships with Docker support: clone the repo, run docker-compose up, and the API is live on localhost:3000. Self-hosting from an Ethiopian IP also bypasses geo-blocks on the Telebirr and M-Pesa endpoints.",
  },  {
    q: "Can I integrate cheki into my POS system?",
    a: "Yes. cheki has a REST API and SDKs for TypeScript, Python, Go, PHP and Dart, and needs no API key, so any POS, online shop or accounting system can call it. Staff can also check receipts on cheki.et with no integration at all.",
  },
  {
    q: "How do I reconcile a day's receipts?",
    a: "Send them to POST /api/verify/batch, up to 20 receipts per call, and match the results against your orders. Count a receipt as paid only when it comes back verified: true, which means the bank's own record confirmed it.",
  },

];
