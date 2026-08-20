import { Badge } from "@craftmyfunnel/ui-sync";

export function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
    </div>
  );
}

export function InContext() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600 }}>Campaign status</span>
      <Badge variant="success">Active</Badge>
    </div>
  );
}
