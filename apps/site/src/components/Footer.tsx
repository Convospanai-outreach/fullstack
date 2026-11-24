import SiteFooter from "@craftmyfunnel/ui/Footer";
import { GlobalCTA } from "@/components/marketing/GlobalCTA";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/trust";

export default function Footer({ hideCTA = false }: { hideCTA?: boolean }) {
    return <SiteFooter siteUrl={""} privacyContact={PRIVACY_CONTACT_EMAIL} cta={hideCTA ? undefined : <GlobalCTA />} />;
}
