import { MarketingGlassCard } from "@craftmyfunnel/ui-sync";

export function WithTitle() {
  return (
    <div style={{ background: "#020617", padding: 24 }}>
      <MarketingGlassCard title="Fluid Funnel Engine">
        Buyer signals, AI outreach, and human review in one governed pipeline.
      </MarketingGlassCard>
    </div>
  );
}

export function WithoutTitle() {
  return (
    <div style={{ background: "#020617", padding: 24 }}>
      <MarketingGlassCard>A minimal glass panel with no heading.</MarketingGlassCard>
    </div>
  );
}
