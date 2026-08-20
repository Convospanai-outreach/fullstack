import { Avatar, AvatarFallback } from "@craftmyfunnel/ui-sync";

// AvatarFallback only — AvatarImage depends on a network image load that
// isn't reliable in a static/headless preview environment.
export function Fallbacks() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <Avatar>
        <AvatarFallback>SD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>JK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
    </div>
  );
}
