import { NavDropdown } from "@craftmyfunnel/ui-sync";
import { LayoutDashboard, Users, Mail } from "lucide-react";

export function Default() {
  return (
    <div style={{ background: "#020617", padding: 16, display: "inline-block" }}>
      <NavDropdown
        label="Product"
        items={[
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/leads", label: "Leads", icon: Users },
          { href: "/campaigns", label: "Campaigns", icon: Mail },
        ]}
      />
    </div>
  );
}
