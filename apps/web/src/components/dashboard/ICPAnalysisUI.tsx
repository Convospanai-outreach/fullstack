import { GlassCard } from "@/components/ui/GlassCard";
import { StatBlock } from "@/components/ui/StatBlock";

interface ICPAnalysisUIProps {
    leadsCount?: number;
    campaignsCount?: number;
}

export function ICPAnalysisUI({ leadsCount = 0, campaignsCount = 0 }: ICPAnalysisUIProps) {
    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-6">ICP Analysis</h3>
            <div className="grid grid-cols-2 gap-4">
                <StatBlock label="Total Leads" value={leadsCount} />
                <StatBlock label="Campaigns" value={campaignsCount} />
            </div>
            <div className="mt-6 space-y-3">
                <div>
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                        <span>Industry Match</span>
                        <span>92%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="bg-green-500 h-full rounded-full" style={{ width: "92%" }}></div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                        <span>Location Match</span>
                        <span>78%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="bg-yellow-500 h-full rounded-full" style={{ width: "78%" }}></div>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
