/**
 * Site-wide structured data: the cheki.et Organization, the WebSite, the open
 * source code, and the maintainer as a Person. One definition, used by the
 * root layout, the guides' Article JSON-LD and the trust pages.
 *
 * The brand is "cheki.et", not bare "cheki": the bare word is a Kenyan car
 * marketplace, a village and several musicians in Google's eyes. sameAs only
 * lists profiles the project actually owns.
 *
 * The maintainer is identified only as the GitHub account 1RB (no real name,
 * no photo: the maintainer's rule).
 */
export const SITE = "https://cheki.et";
export const ORGANIZATION_ID = `${SITE}/#organization`;
export const WEBSITE_ID = `${SITE}/#website`;
export const MAINTAINER_ID = `${SITE}/#maintainer`;

/** Raster logo for Google (needs at least 112x112, crawlable): public/logo.png. */
export const LOGO = { url: `${SITE}/logo.png`, width: 512, height: 512 } as const;

export const REPO_URL = "https://github.com/1RB/cheki";

/** Profiles the project owns: the repository and the published SDK packages. */
export const SAME_AS = [
  REPO_URL,
  "https://www.npmjs.com/package/cheki-verify",
  "https://pypi.org/project/cheki/",
  "https://packagist.org/packages/cheki/cheki",
  "https://pkg.go.dev/github.com/1RB/cheki/sdks/go",
] as const;

export const MAINTAINER_PERSON = {
  "@type": "Person",
  "@id": MAINTAINER_ID,
  name: "1RB",
  url: "https://github.com/1RB",
  sameAs: ["https://github.com/1RB"],
} as const;

/** The Organization as a reference plus the fields Google reads from a publisher. */
export const PUBLISHER = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "cheki.et",
  url: SITE,
  logo: { "@type": "ImageObject", url: LOGO.url, width: LOGO.width, height: LOGO.height },
} as const;

export const organizationJsonLd = {
  "@context": "https://schema.org",
  ...PUBLISHER,
  alternateName: ["cheki"],
  description: "Free, open-source Ethiopian bank receipt verification service.",
  sameAs: [...SAME_AS],
  foundingDate: "2026",
  founder: { "@id": MAINTAINER_ID },
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: "cheki.et",
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
