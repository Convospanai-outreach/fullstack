import { CtaBand } from "@/components/marketing/site/kit";
import { siteSans, siteSerif } from "@/components/marketing/home/fonts";
import { SITE_URL } from "../../../config/siteUrl.mjs";

export function GlobalCTA() {
  return (
    <div className={`ph ${siteSans.variable} ${siteSerif.variable}`}>
      <CtaBand
        title="Talk to an expert"
        lead="Start with one service, one market and one month. We'll measure replies and meetings, not activity."
        primary={{ label: "Get started", href: "/signup" }}
        secondary={{ label: "View pricing", href: `${SITE_URL}/pricing` }}
      />
    </div>
  );
}
