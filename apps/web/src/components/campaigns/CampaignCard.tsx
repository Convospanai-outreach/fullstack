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
    const leadCount = campaign._count?.leads || 0;
    const progress =
        campaign.targetCount > 0
            ? (campaign.completedCount / campaign.targetCount) * 100
            : 0;

    return (
        <Link href={`/campaigns/${campaign.id}`}>
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {campaign.name}
                    </h3>
                    <StatusBadge status={campaign.status} />
                </div>

                {campaign.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {campaign.description}
                    </p>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Progress</span>
                        <span>
                            {campaign.completedCount} / {campaign.targetCount}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-gray-500">
                    <span>{leadCount} leads</span>
                    <span>
                        Updated {new Date(campaign.updatedAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </Link>
    );
}
