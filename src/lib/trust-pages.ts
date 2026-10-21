/**
 * Content of the trust pages: /about, /privacy and /contact.
 *
 * Kept as data so tests can hold every claim to the code it describes: the
 * rate limits come from rate-limit-config, the cache lifetime from
 * receipt-cache, the recent-checks limit from verify/history. When one of
 * those changes, the page changes with it.
 *
 * The maintainer is named as Ray (@1RB on GitHub): first name and GitHub
 * handle only. No surname, no photo, no personal email, no location: that is
 * Ray's rule, and tests/content/trust-pages.test.ts enforces it. /about's
 * "Why I built it" and maintainer sections are written by Ray in the first
 * person; everything else stays in the product's voice ("cheki does X").
 */
import { coverageSentence } from "./bank-counts";
import { RATE_LIMITS } from "./rate-limit-config";
import { DEFAULT_TTL_MS } from "./receipt-cache";
import { HISTORY_LIMIT } from "./verify/history";

export const REPO_URL = "https://github.com/1RB/cheki";
export const MAINTAINER = { name: "Ray", handle: "1RB", url: "https://github.com/1RB" } as const;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;
/** .github/ISSUE_TEMPLATE/bank-request.yml (labels it bank-wanted). */
export const NEW_BANK_ISSUE_URL = `${REPO_URL}/issues/new?template=bank-request.yml`;
/** The contribution bot already linked from /banks ("Send via Telegram"). */
export const TELEGRAM_BOT_URL = "https://t.me/raysterminalbot";

/** Plain text, or a link. Internal hrefs start with "/". */
export type Inline = string | { href: string; text: string };

export interface TrustSection {
  id: string;
  heading: string;
  paragraphs?: Inline[][];
  bullets?: Inline[][];
}

export interface TrustPage {
  path: "/about" | "/privacy" | "/contact";
  /** <title> (the layout appends " | cheki"). */
  title: string;
  /** The H1. */
  heading: string;
  description: string;
  /** Last content change (YYYY-MM-DD): shown as "Updated", the sitemap lastmod and dateModified. */
  updated: string;
  intro: Inline[];
  sections: TrustSection[];
}

const minutes = (ms: number) => Math.round(ms / 60_000);
const perMinute = (l: { limit: number; windowMs: number }) => Math.round((l.limit * 60_000) / l.windowMs);
const CACHE_HOURS = Math.round(DEFAULT_TTL_MS / 3_600_000);

export const ABOUT: TrustPage = {
  path: "/about",
  title: "About cheki.et: Free, Open-Source Ethiopian Receipt Verification",
  heading: "About cheki.et",
  description:
    "What cheki.et is, how it checks a receipt with the bank, who maintains it and why it is free and open source (MIT).",
  updated: "2026-10-21",
  intro: [
    "cheki.et is a free, open-source tool that checks whether an Ethiopian bank or wallet receipt is real. You paste a receipt link, a QR code or a transaction reference, and cheki asks the bank's own receipt record what it says.",
  ],
  sections: [
    {
      id: "how-it-works",
      heading: "How a check works",
      paragraphs: [
        [
          `Ethiopian banks and wallets publish each receipt at a public address on their own servers. cheki works out which bank a receipt belongs to, fetches that receipt from the bank, and shows the sender, receiver, amount and date it returns, with a link to the bank's own page so you can open it yourself. That covers ${coverageSentence()}; the `,
          { href: "/banks", text: "bank list" },
          " says which, and ",
          { href: "/status", text: "endpoint status" },
          " says which bank pages answer today.",
        ],
        [
          "A green result means one thing only: the bank confirmed the receipt. A QR code, a screenshot or pasted receipt text is never enough on its own, because anyone can make one. Telebirr and M-Pesa block cloud servers, so for those cheki says it could not check and gives you the official receipt page instead of a guess. Direct checks return once a local relay is live.",
        ],
      ],
    },
    {
      id: "why-i-built-it",
      heading: "Why I built it",
      paragraphs: [
        [
          "Every day in Ethiopia, shops hand over goods because a customer showed them a screenshot that says \"Transfer successful.\" Some of those screenshots are fake, and a small shop can lose a week's profit to one of them.",
        ],
        [
          "The fix already exists. Each bank and wallet publishes the receipt at a public address on its own servers. Checking a payment just means asking the bank's page what it says. Yet I kept seeing that answer sold back to businesses through monthly plans, API keys and per-check quotas.",
        ],
        [
          "I don't think a shop owner should have to pay to read a page their own bank already made public. So cheki is free for everyone, with no account and no key. It's open source, so any developer can build it into a checkout, a Telegram bot or a point-of-sale app, or run it on their own server.",
        ],
        ["If cheki saves one shop from one fake receipt, it's done its job."],
      ],
    },
    {
      id: "free-and-open-source",
      heading: "Free and open source",
      paragraphs: [
        [
          "cheki is MIT licensed. The web app, the API, the parsers for every bank and the SDKs for TypeScript, Python, Go, PHP and Dart are all in one public repository: ",
          { href: REPO_URL, text: "github.com/1RB/cheki" },
          ". Anyone can read how a receipt is checked, run it on their own server, or send a fix.",
        ],
        [
          "The hosted API at cheki.et has per-IP rate limits so one client cannot crowd out everyone else; ",
          { href: "/docs", text: "the docs" },
          " list them, and self-hosting removes them.",
        ],
      ],
    },
    {
      id: "who-maintains-it",
      heading: "Who maintains it",
      paragraphs: [
        [
          "I'm Ray (",
          { href: MAINTAINER.url, text: "@1RB on GitHub" },
          "). I build and maintain cheki, with fixes and new banks from contributors. It is an independent project: it is not affiliated with, endorsed by or paid by any Ethiopian bank, wallet or payment company.",
        ],
        [
          "Questions, bug reports and new banks reach me through ",
          { href: "/contact", text: "the contact page" },
          ". What cheki does with the data you check is on ",
          { href: "/privacy", text: "the privacy page" },
          ".",
        ],
      ],
    },
  ],
};

export const PRIVACY: TrustPage = {
  path: "/privacy",
  title: "Privacy at cheki.et: What a Receipt Check Processes",
  heading: "Privacy",
  description:
    "What cheki.et processes when you check a receipt, what it keeps (almost nothing, and only briefly), its cookieless analytics and its per-IP rate limits.",
  updated: "2026-10-15",
  intro: [
    "cheki.et has no accounts and no database. This page says what happens to what you send it, and it follows the code in ",
    { href: REPO_URL, text: "the public repository" },
    ", so you can check every line.",
  ],
  sections: [
    {
      id: "receipt-checks",
      heading: "When you check a receipt",
      bullets: [
        [
          "What you send (a receipt link, a reference, account digits or a phone number when the bank needs them) goes to cheki's server, which uses it to fetch that receipt from the bank and returns what the bank says. It is not written to a database or a file.",
        ],
        [
          `A receipt the bank confirmed is kept in the server's memory for up to ${CACHE_HOURS} hours, so checking it again does not ask the bank again. It includes what the bank returned (names, amount, date). Failed checks are never kept, and the memory is cleared whenever the server restarts.`,
        ],
        [
          "A screenshot you upload is shrunk on your device first (which drops its location data) and sent to cheki only to look for a QR code. It is read in memory and discarded. If there is no QR code, the text is read in your browser and the image does not leave your device again.",
        ],
        [
          "Receipt text you paste, or a receipt page sent by the bookmarklet, is read and returned the same way. It is never marked verified, because the bank did not confirm it.",
        ],
      ],
    },
    {
      id: "on-your-device",
      heading: "What stays on your device",
      bullets: [
        [
          `Recent checks: the last ${HISTORY_LIMIT} receipts a bank confirmed on this device (bank, reference, amount and time, no names), kept in your browser's local storage. Clearing site data removes them.`,
        ],
        ["Your theme and language choice, in the same local storage. cheki sets no cookies."],
      ],
    },
    {
      id: "analytics",
      heading: "Analytics",
      paragraphs: [
        [
          "cheki.et counts page views with Vercel Web Analytics, which uses no cookies and keeps no personal identifier (",
          { href: "https://vercel.com/docs/analytics/privacy-policy", text: "Vercel's description" },
          "). Before a view is sent, cheki removes the query string and the # part of the address, never counts API calls, and drops any address that is not one of its own pages. So no receipt reference, receipt link or account number reaches analytics.",
        ],
      ],
    },
    {
      id: "rate-limits",
      heading: "Rate limits and your IP address",
      paragraphs: [
        [
          `The hosted API limits requests per IP address: ${perMinute(RATE_LIMITS.verify)} checks a minute, ${perMinute(RATE_LIMITS.batch)} batch requests a minute, ${perMinute(RATE_LIMITS.parse)} pasted receipts and ${perMinute(RATE_LIMITS.ocr)} screenshots a minute, and ${RATE_LIMITS.contribute.limit} contributions every ${minutes(RATE_LIMITS.contribute.windowMs)} minutes. To count them, the server holds your IP address and the times of your recent requests in memory for that window. They are not written anywhere.`,
        ],
        [
          "cheki.et runs on Vercel, which handles every request to serve the site and keeps its own platform logs under ",
          { href: "https://vercel.com/legal/privacy-policy", text: "Vercel's privacy policy" },
          ". cheki's own code does not log receipt details.",
        ],
      ],
    },
    {
      id: "contributions",
      heading: "Receipts you contribute",
      paragraphs: [
        [
          "When you send a receipt to help add a bank, it is forwarded to the maintainers' private Telegram chat and not stored by cheki.et. Telegram holds the only copy, which is deleted once the bank's parser is built. Test data in the repository is synthetic or redacted; real receipts are never committed.",
        ],
        [
          "To ask about your data, or to have a contributed receipt deleted sooner, see ",
          { href: "/contact", text: "contact" },
          ". More about the project is on ",
          { href: "/about", text: "the about page" },
          ".",
        ],
      ],
    },
  ],
};

export const CONTACT: TrustPage = {
  path: "/contact",
  title: "Contact cheki.et: Issues, New Banks and Security Reports",
  heading: "Contact",
  description:
    "How to reach the cheki.et maintainers: GitHub issues for bugs and questions, a private form or Telegram for receipts, and a private channel for security reports.",
  updated: "2026-10-15",
  intro: [
    "cheki.et is run in the open, so most conversations happen on GitHub. Pick the channel that fits.",
  ],
  sections: [
    {
      id: "questions-and-bugs",
      heading: "Questions, bugs and ideas",
      paragraphs: [
        [
          "Open an issue on ",
          { href: NEW_ISSUE_URL, text: "GitHub" },
          ". Search ",
          { href: ISSUES_URL, text: "the existing issues" },
          " first; yours may already have an answer. Leave out real account numbers and names: issues are public.",
        ],
      ],
    },
    {
      id: "new-banks",
      heading: "A bank that isn't supported yet",
      paragraphs: [
        [
          "Send a receipt link or a screenshot with the QR code, and it can become a new bank in cheki. Use the private form on the bank's page under ",
          { href: "/banks", text: "banks" },
          ", the ",
          { href: TELEGRAM_BOT_URL, text: "Telegram contribution bot" },
          ", or a ",
          { href: NEW_BANK_ISSUE_URL, text: "bank request issue" },
          " if you are happy to share it publicly. The ",
          { href: "/guides/contribute-new-bank", text: "contribution guide" },
          " explains what helps.",
        ],
      ],
    },
    {
      id: "security",
      heading: "Security problems",
      paragraphs: [
        [
          "Please don't put the details in a public issue. Message the maintainers privately through the ",
          { href: TELEGRAM_BOT_URL, text: "Telegram bot" },
          ", or open an issue that only asks for a private channel, and the details can follow there.",
        ],
      ],
    },
    {
      id: "who-answers",
      heading: "Who answers",
      paragraphs: [
        [
          "The maintainer, Ray (",
          { href: MAINTAINER.url, text: "@1RB" },
          "), and contributors. cheki.et is not a bank and cannot reverse, refund or trace a payment: for that, contact your bank or wallet. How your data is handled is on ",
          { href: "/privacy", text: "the privacy page" },
          "; what cheki is, on ",
          { href: "/about", text: "the about page" },
          ".",
        ],
      ],
    },
  ],
};

export const TRUST_PAGES: readonly TrustPage[] = [ABOUT, PRIVACY, CONTACT];

/** Every string a reader sees on a trust page, for tests. */
export function trustPageText(p: TrustPage): string {
  const inl = (xs: Inline[]) => xs.map((x) => (typeof x === "string" ? x : x.text)).join("");
  return [
    p.title,
    p.heading,
    p.description,
    inl(p.intro),
    ...p.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []).map(inl), ...(s.bullets ?? []).map(inl)]),
  ].join("\n");
}

/** Every link on a trust page. */
export function trustPageLinks(p: TrustPage): { href: string; text: string }[] {
  const all = [p.intro, ...p.sections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])])];
  return all.flat().filter((x): x is { href: string; text: string } => typeof x !== "string");
}
