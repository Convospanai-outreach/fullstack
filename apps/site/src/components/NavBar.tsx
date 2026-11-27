import { NavBar as SiteNavBar } from "@craftmyfunnel/ui/NavBar";
import { cleanNavGroups } from "@/lib/siteContent";
import navigation from "../../content/settings/navigation.json";
import { APP_URL } from "../../config/appUrl.mjs";

export function NavBar() {
    return <SiteNavBar groups={cleanNavGroups(navigation)} siteUrl="" appUrl={APP_URL} />;
}
