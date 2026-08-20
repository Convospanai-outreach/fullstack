import { NotificationBell } from "@craftmyfunnel/ui-sync";

// The preview build's @clerk/nextjs stub reports a signed-in user, matching
// the only state in which this component renders anything.
export function Default() {
  return (
    <div style={{ background: "#0b0f1a", padding: 12, borderRadius: 8 }}>
      <NotificationBell />
    </div>
  );
}
