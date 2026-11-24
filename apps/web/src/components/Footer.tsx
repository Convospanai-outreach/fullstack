import SiteFooter from "@craftmyfunnel/ui/Footer";
import { GlobalCTA } from "@/components/marketing/GlobalCTA";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/trust";
import { SITE_URL } from "../../config/siteUrl.mjs";

export default function Footer({ hideCTA = false }: { hideCTA?: boolean }) {
    return <SiteFooter siteUrl={SITE_URL} privacyContact={PRIVACY_CONTACT_EMAIL} cta={hideCTA ? undefined : <GlobalCTA />} />;
}
