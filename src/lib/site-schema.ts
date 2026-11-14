/**
 * Site-wide structured data: the cheki.et Organization, the WebSite, the open
 * source code, and the maintainer as a Person. One definition, used by the
 * root layout, the guides' Article JSON-LD and the trust pages.
 *
 * The brand is "cheki.et", not bare "cheki": the bare word is a Kenyan car
 * marketplace, a village and several musicians in Google's eyes. sameAs only
 * lists profiles the project actually owns.
 *
 * The maintainer is a Person: Ray, alternateName 1RB, identified by the GitHub
 * profile. First name and handle only: no surname, no photo (Ray's rule).
 */
export const SITE = "https://cheki.et";

/**
 * The one name for the entity, everywhere: the Organization, the WebSite,
 * the WebApplication, the <title> suffix, Open Graph, llms.txt and the
 * profiles in SAME_AS. Bare "cheki" is only ever an alternateName.
 */
export const BRAND = "cheki.et";
/** The <title> template every page uses ("CBE Receipt Check: ... | cheki.et"). */
export const TITLE_TEMPLATE = `%s | ${BRAND}`;
export const ORGANIZATION_ID = `${SITE}/#organization`;
export const WEBSITE_ID = `${SITE}/#website`;
export const MAINTAINER_ID = `${SITE}/#maintainer`;
export const WEBAPP_ID = `${SITE}/#webapp`;

/** Raster logo for Google (needs at least 112x112, crawlable): public/logo.png. */
export const LOGO = { url: `${SITE}/logo.png`, width: 512, height: 512 } as const;

export const REPO_URL = "https://github.com/1RB/cheki";

/**
 * Brand profiles the project runs itself, under the cheki.et name. Listed on
 * /about too, so the sameAs links are visible on the site and not only in
 * the JSON-LD. Add one only once it is live and owned by the project.
 */
export const BRAND_PROFILES = [
  { name: "GitHub", url: REPO_URL },
  { name: "LinkedIn", url: "https://www.linkedin.com/company/chekiet/" },
  { name: "DEV", url: "https://dev.to/cheki" },
  { name: "Launch.et", url: "https://launch.et/product/cheki-et" },
] as const;

/** The published SDK packages. */
export const PACKAGE_PROFILES = [
  "https://www.npmjs.com/package/cheki-verify",
  "https://pypi.org/project/cheki/",
  "https://packagist.org/packages/cheki/cheki",
  "https://pkg.go.dev/github.com/1RB/cheki/sdks/go",
  "https://pub.dev/packages/cheki",
] as const;

/** Profiles the project owns: the repository first, then the brand profiles and the SDK packages. */
export const SAME_AS = [...BRAND_PROFILES.map((p) => p.url), ...PACKAGE_PROFILES] as const;

/**
 * What the entity does, in the words people search with. Used as the
 * Organization's knowsAbout and the WebApplication's description, and each
 * phrase matches a page that does it (a bank page, the fraud guide, /docs).
 */
export const ENTITY_TOPICS = [
  "Ethiopian bank receipt verification",
  "CBE receipt check",
  "Telebirr receipt check",
  "Bank of Abyssinia receipt check",
  "Fake receipt detection in Ethiopia",
  "Ethiopian payment verification API",
] as const;

export const ENTITY_DESCRIPTION =
  "cheki.et is a free, open-source receipt checker for Ethiopian banks and wallets. It checks a CBE, BOA, Dashen or other bank receipt against the bank's own record from its QR code or receipt link, and opens Telebirr and M-Pesa receipts on their official receipt pages. It is not affiliated with any bank.";

export const MAINTAINER_PERSON = {
  "@type": "Person",
  "@id": MAINTAINER_ID,
  name: "Ray",
  alternateName: "1RB",
  url: "https://github.com/1RB",
  sameAs: ["https://github.com/1RB"],
} as const;

/** The Organization as a reference plus the fields Google reads from a publisher. */
export const PUBLISHER = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: BRAND,
  url: SITE,
  logo: { "@type": "ImageObject", url: LOGO.url, width: LOGO.width, height: LOGO.height },
} as const;

export const organizationJsonLd = {
  "@context": "https://schema.org",
  ...PUBLISHER,
  alternateName: ["cheki"],
  description: ENTITY_DESCRIPTION,
  sameAs: [...SAME_AS],
  knowsAbout: [...ENTITY_TOPICS],
  foundingDate: "2026",
  founder: MAINTAINER_PERSON,
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: BRAND,
  alternateName: ["cheki"],
  url: `${SITE}/`,
  publisher: { "@id": ORGANIZATION_ID },
};

export const sourceCodeJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "cheki",
  description: "Source code of cheki.et: web app, REST API, bank receipt parsers and SDKs.",
  codeRepository: REPO_URL,
  license: "https://opensource.org/licenses/MIT",
  programmingLanguage: ["TypeScript", "Python", "Go", "PHP", "Dart"],
  author: MAINTAINER_PERSON,
  publisher: { "@id": ORGANIZATION_ID },
};

/**
 * The checker itself. WebApplication is a SoftwareApplication subtype; no
 * aggregateRating, since there are no reviews to mark up.
 */
export const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": WEBAPP_ID,
  name: BRAND,
  alternateName: ["cheki", "cheki receipt checker"],
  url: `${SITE}/`,
  publisher: { "@id": ORGANIZATION_ID },
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  inLanguage: ["en", "am"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "ETB" },
  description: ENTITY_DESCRIPTION,
  featureList: [
    "Check a receipt from its QR code, receipt link or reference",
    "Bank receipt check against the bank's own record",
    "Batch check of up to 20 receipts",
    "REST API with no API key",
    "TypeScript, Python, Dart, PHP and Go SDKs",
    "Self-hosting with Docker",
    "Daily health check of each bank's receipt endpoint",
  ],
};
