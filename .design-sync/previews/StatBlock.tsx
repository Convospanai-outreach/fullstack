import { StatBlock } from "@craftmyfunnel/ui-sync";

export function Metrics() {
  return (
    <div style={{ background: "#020617", padding: 16, display: "flex", gap: 16 }}>
      <StatBlock label="Leads contacted" value={1204} />
      <StatBlock label="Reply rate" value="26%" />
      <StatBlock label="Meetings booked" value={38} />
    </div>
  );
}
