"use client";

import { usePathname } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SETTINGS_GROUPS } from "@/lib/navSections";

interface GovernanceLayoutProps {
    children: React.ReactNode;
}

// Governance pages now render under Settings > Trust (governance/layout.tsx), so this no
// longer draws its own tab bar; it only titles the page with its Settings menu label.
export default function GovernanceLayout({ children }: GovernanceLayoutProps) {
    const pathname = usePathname();
    const title = SETTINGS_GROUPS.flatMap((group) => group.links).find((link) => link.href === pathname)?.label;

    return (
        <div className="space-y-8 animate-reveal">
            {title && <SectionHeader title={title} />}
            {children}
        </div>
    );
}
