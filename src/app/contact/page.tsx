import { TrustPageView, trustPageMetadata } from "@/components/TrustPageView";
import { CONTACT } from "@/lib/trust-pages";

export const metadata = trustPageMetadata(CONTACT);

export default function Page() {
  return <TrustPageView page={CONTACT} />;
}
