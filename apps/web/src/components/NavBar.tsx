import { NavBar as SiteNavBar } from "@craftmyfunnel/ui/NavBar";
import { cleanNavGroups } from "@/lib/siteContent";
import navigation from "../../../site/content/settings/navigation.json";
import { SITE_URL } from "../../config/siteUrl.mjs";

export function NavBar() {
    return <SiteNavBar groups={cleanNavGroups(navigation)} siteUrl={SITE_URL} appUrl="" />;
}
