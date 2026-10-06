import { homeFaqs } from "@/lib/home-faq";
import { HomePage } from "@/components/HomePage";

// Kept on this server component on purpose: the FAQPage JSON-LD must describe
// questions that are visible on this exact page, so it is emitted from the
// same array the visible <details> list renders from.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomePage />
    </>
  );
}
