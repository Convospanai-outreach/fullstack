import { CtaBand } from "@/components/marketing/site/kit";
import { montserrat } from "@/components/marketing/home/fonts";

export function GlobalCTA() {
  return (
    <div className={`ph ${montserrat.variable}`}>
      <CtaBand
        title="Talk to an expert"
        lead="Start with one service, one market and one month. We'll measure replies and meetings, not activity."
        primary={{ label: "Get started", href: "/signup" }}
        secondary={{ label: "View pricing", href: "/pricing" }}
      />
    </div>
  );
}
