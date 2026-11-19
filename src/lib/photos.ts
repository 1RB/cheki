/**
 * Photographs of the world cheki works in: Addis Ababa's shops, counters and
 * banks. None of them shows cheki, its users or a customer; each is a real,
 * openly licensed photograph, credited on every page that shows it
 * (src/components/PhotoCredits.tsx).
 *
 * Files are in public/photos, resized to 1280px (900px for the portrait) and
 * encoded as WebP; next/image serves smaller widths from them. Licences:
 * CC BY-SA and CC0 photographs from Wikimedia Commons, unaltered apart from
 * resizing.
 */
export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  creator: string;
  license: "CC BY-SA 2.0" | "CC BY-SA 4.0" | "CC0";
  licenseUrl: string;
  /** The photograph's page on Wikimedia Commons. */
  source: string;
}

const BY_SA_2 = "https://creativecommons.org/licenses/by-sa/2.0/";
const BY_SA_4 = "https://creativecommons.org/licenses/by-sa/4.0/";
const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

export const PHOTOS = {
  counter: {
    src: "/photos/counter-kiosk.webp",
    width: 1280,
    height: 872,
    alt: "A small shop counter in Addis Ababa: a hand scale and goods on wooden shelves behind a green corrugated front.",
    creator: "Rod Waddington",
    license: "CC BY-SA 2.0",
    licenseUrl: BY_SA_2,
    source: "https://commons.wikimedia.org/wiki/File:Local_Store,_Addis_Ababa_(7499750144).jpg",
  },
  merkato: {
    src: "/photos/merkato-street.webp",
    width: 1280,
    height: 853,
    alt: "A busy street of shops and stalls in Merkato, Addis Ababa, seen from above.",
    creator: "Diego Delso",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Addis_Mercato,_Ad%C3%ADs_Abeba,_Etiop%C3%ADa,_2024-01-19,_DD_26.jpg",
  },
  shopByNight: {
    src: "/photos/shop-by-night.webp",
    width: 1280,
    height: 720,
    alt: "A lit fruit and vegetable shop on an Addis Ababa street at night, with customers at the counter.",
    creator: "Jean Rebiffé",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:01_-_Vegetable_shop_by_night_in_Addis_Ababa,_Ethiopia.jpg",
  },
  cbeHeadOffice: {
    src: "/photos/cbe-head-office.webp",
    width: 900,
    height: 1195,
    alt: "The Commercial Bank of Ethiopia head office tower in Addis Ababa.",
    creator: "Dagmawi-M",
    license: "CC BY-SA 4.0",
    licenseUrl: BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Commercial_Bank_of_Ethiopia_CBE-HEAD_OFFICE.jpg",
  },
  cbe1969: {
    src: "/photos/cbe-1969.webp",
    width: 1280,
    height: 850,
    alt: "The Commercial Bank of Ethiopia building in Addis Ababa in 1969, black and white.",
    creator: "Eric Koch for Anefo",
    license: "CC0",
    licenseUrl: CC0,
    source: "https://commons.wikimedia.org/wiki/File:Addis_Abeba_,_Ethiopie_Commercial_Bank_of_Ethiopia,_Bestanddeelnr_922-0344.jpg",
  },
  birr: {
    src: "/photos/birr-note.webp",
    width: 1280,
    height: 559,
    alt: "A one birr banknote from 1998, issued by the National Bank of Ethiopia.",
    creator: "Flosegura",
    license: "CC0",
    licenseUrl: CC0,
    source: "https://commons.wikimedia.org/wiki/File:Baknote_of_Ethiopia.jpg",
  },
} satisfies Record<string, Photo>;

export type PhotoId = keyof typeof PHOTOS;
