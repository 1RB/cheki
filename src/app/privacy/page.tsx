import { TrustPageView, trustPageMetadata } from "@/components/TrustPageView";
import { PRIVACY } from "@/lib/trust-pages";

export const metadata = trustPageMetadata(PRIVACY);

export default function Page() {
  return <TrustPageView page={PRIVACY} />;
}
