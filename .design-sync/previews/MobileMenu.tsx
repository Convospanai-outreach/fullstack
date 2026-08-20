import { MobileMenu } from "@craftmyfunnel/ui-sync";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/leads", label: "Leads" },
  { href: "/settings", label: "Settings" },
];

export function Open() {
  return <MobileMenu isOpen onClose={() => {}} links={links} />;
}
