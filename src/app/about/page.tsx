import { TrustPageView, trustPageMetadata } from "@/components/TrustPageView";
import { ABOUT } from "@/lib/trust-pages";

export const metadata = trustPageMetadata(ABOUT);

export default function Page() {
  return <TrustPageView page={ABOUT} />;
}
