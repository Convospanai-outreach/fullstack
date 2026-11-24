import { CtaBand } from "@/components/marketing/site/kit";
import { siteSans, siteSerif } from "@/components/marketing/home/fonts";
import { APP_URL } from "../../../config/appUrl.mjs";

export function GlobalCTA() {
  return (
    <div className={`ph ${siteSans.variable} ${siteSerif.variable}`}>
      <CtaBand
        title="Talk to an expert"
        lead="Start with one service, one market and one month. We'll measure replies and meetings, not activity."
        primary={{ label: "Get started", href: `${APP_URL}/signup` }}
        secondary={{ label: "View pricing", href: "/pricing" }}
      />
    </div>
  );
}
