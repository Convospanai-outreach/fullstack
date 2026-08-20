import { FeatureGrid, MarketingGlassCard } from "@craftmyfunnel/ui-sync";

export function Default() {
  return (
    <div style={{ background: "#020617", padding: 24 }}>
      <FeatureGrid>
        <MarketingGlassCard title="Buyer signals">
          Detect intent across the web before your competitors do.
        </MarketingGlassCard>
        <MarketingGlassCard title="AI outreach">
          Personalized sequences that sound like a human wrote them.
        </MarketingGlassCard>
        <MarketingGlassCard title="Governed automation">
          Every action is approved, logged, and reversible.
        </MarketingGlassCard>
      </FeatureGrid>
    </div>
  );
}
