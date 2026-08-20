import { GlassCard } from "@craftmyfunnel/ui-sync";

export function Default() {
  return (
    <GlassCard style={{ maxWidth: 340 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Clerk sync status</p>
      <p style={{ fontSize: 14, opacity: 0.8 }}>
        Last synced 3 minutes ago. 1,204 contacts up to date.
      </p>
    </GlassCard>
  );
}
