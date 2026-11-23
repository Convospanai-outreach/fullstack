import Link from "next/link";
import StatusBadge from "./StatusBadge";

interface CampaignCardProps {
    campaign: {
        id: string;
        name: string;
        description?: string;
        status: string;
        targetCount: number;
        completedCount: number;
        createdAt: Date | string;
        updatedAt: Date | string;
        _count?: {
            leads: number;
        };
    };
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
    const leadCount = campaign._count?.leads || campaign.targetCount || 0;
    const actualCompleted = Math.min(campaign.completedCount, leadCount > 0 ? leadCount : campaign.completedCount);
    const progress =
        leadCount > 0
            ? Math.min(100, Math.round((actualCompleted / leadCount) * 100))
            : 0;

    return (
        <Link href={`/campaigns/${campaign.id}`}>
            <div className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-card">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                        {campaign.name}
                    </h3>
                    <StatusBadge status={campaign.status} />
                </div>

                {campaign.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {campaign.description}
                    </p>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span>
                            {actualCompleted} / {leadCount}
                        </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span>{leadCount} leads</span>
                    <span>
                        Updated {new Date(campaign.updatedAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </Link>
    );
}
