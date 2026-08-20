import { Progress } from "@craftmyfunnel/ui-sync";

export function Values() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 320 }}>
      <Progress value={25} />
      <Progress value={60} />
      <Progress value={90} />
    </div>
  );
}
