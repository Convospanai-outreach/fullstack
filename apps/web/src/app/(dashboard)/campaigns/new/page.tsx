"use client";

import { useRouter } from "next/navigation";
import StrategyWizard from "@/components/campaigns/StrategyWizard";

export default function NewCampaignPage() {
    const router = useRouter();

    return (
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
            <StrategyWizard onClose={() => router.push("/campaigns")} />
        </div>
    );
}
