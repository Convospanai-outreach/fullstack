"use client";

import { useRouter } from "next/navigation";
import StrategyWizard from "@/components/campaigns/StrategyWizard";

export default function NewCampaignPage() {
    const router = useRouter();

    return (
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-4">
            <StrategyWizard onClose={() => router.push("/campaigns")} />
        </div>
    );
}
