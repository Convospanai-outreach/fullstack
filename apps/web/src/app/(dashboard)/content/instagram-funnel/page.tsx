"use client";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { InstagramFunnelSetup } from "@/components/content/InstagramFunnelSetup";

export default function InstagramFunnelPage() {
    return (
        <div className="space-y-6">
            <SectionHeader title="Instagram to landing page" subtitle="Set up the path from an Instagram comment to a lead in CraftMyFunnel." />
            <InstagramFunnelSetup />
        </div>
    );
}
