"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BriefReview from "@/components/landing-agent/BriefReview";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import type { LandingCampaign } from "@/modules/landing-agent/types";

export default function LandingAgentBriefPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [campaign, setCampaign] = useState<LandingCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const campaignId = typeof params?.id === "string" ? params.id : "";

    const loadCampaign = useCallback(async () => {
        if (!campaignId) return;
        setError(null);
        const data = await landingAgentApi.getCampaign(campaignId);
        setCampaign(data);
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId) return;
        setLoading(true);
        loadCampaign()
            .catch((err: any) => setError(err?.message || "Failed to load campaign"))
            .finally(() => setLoading(false));
    }, [campaignId, loadCampaign]);

    if (loading) {
        return <div className="p-8 text-slate-300">Loading campaign...</div>;
    }

    if (!campaign || error) {
        return <div className="p-8 text-rose-300">{error || "Campaign not found"}</div>;
    }

    return (
        <div className="p-6 lg:p-8">
            <BriefReview
                campaign={campaign}
                onRefresh={loadCampaign}
                onAdvance={() => router.push(`/landing-agent/${campaign.id}/wireframes`)}
            />
        </div>
    );
}
