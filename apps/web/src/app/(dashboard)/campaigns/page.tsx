import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChevronDown, Megaphone, Plus, Search } from "lucide-react";
import ExportButton from "@/modules/data-export/ui/ExportButton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

async function loadCampaigns(searchParams: PageSearchParams) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return { campaigns: [], unauthorized: true };

    const search = firstParam(searchParams["search"]).trim();
    const status = firstParam(searchParams["status"]).trim();
    const where: any = { teamId };

    if (status) where.status = status;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }

    const campaigns = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { leadList: true } } },
    });

    return { campaigns, unauthorized: false };
}

export default async function CampaignsPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
    const params = (await searchParams) || {};
    const search = firstParam(params["search"]);
    const status = firstParam(params["status"]);
    const { campaigns, unauthorized } = await loadCampaigns(params);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-xl font-normal text-white font-outfit tracking-tight flex items-center gap-2">
                        <span className="text-zinc-600 font-mono text-sm">[02]</span>
                        Outreach Campaigns
                    </h1>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-xl font-sans leading-relaxed">
                        Deploy customer outreach sequences, monitor execution telemetry, and manage automated workflow configurations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton type="campaigns" />

                    <Link href="/campaigns/new" id="create-campaign-btn">
                        <button className="h-8 bg-zinc-100 hover:bg-white px-3 text-[11px] font-medium text-zinc-950 transition-colors flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            Create Campaign
                        </button>
                    </Link>
                </div>
            </div>

            <form className="bg-[#030303] border-[0.5px] border-white/10 p-4 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                        type="text"
                        name="search"
                        placeholder="QUERY SEQUENCES: Search by campaign name or description..."
                        className="w-full bg-[#060606] border border-white/10 pl-9 pr-4 py-2 text-[12.5px] font-mono placeholder:text-zinc-600 text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
                        defaultValue={search}
                        id="campaign-search-input"
                    />
                </div>

                <div className="relative md:w-48">
                    <select
                        name="status"
                        defaultValue={status}
                        className="w-full bg-[#060606] border border-white/10 px-3 py-2 text-[12px] font-mono text-zinc-300 outline-none appearance-none focus:border-zinc-500 transition-colors cursor-pointer"
                        id="campaign-status-select"
                    >
                        <option value="">ALL CAMPAIGNS</option>
                        <option value="active">ACTIVE ONLY</option>
                        <option value="paused">PAUSED ONLY</option>
                        <option value="draft">DRAFTS ONLY</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-3 w-3 text-zinc-500 pointer-events-none" />
                </div>
                <button className="h-9 border border-white/10 px-4 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors">
                    Search
                </button>
            </form>

            {unauthorized ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2">
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">Sign In Required</h3>
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2 flex flex-col items-center justify-center">
                    <Megaphone className="w-10 h-10 text-zinc-600 mb-4 stroke-[1]" />
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">No Campaigns Found</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm font-sans">
                        No sequences match your search criteria. Create an outreach campaign to start queueing contacts.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    {campaigns.map((campaign, index) => {
                        const isActive = campaign.status === "active";
                        const leadCount = campaign._count?.leadList || campaign.leads || 0;
                        const completedCount = campaign.completedCount || 0;
                        const completionRate = leadCount > 0 ? Math.round((completedCount / leadCount) * 100) : 0;

                        return (
                            <div
                                key={campaign.id}
                                className="relative flex flex-col justify-between p-5 bg-[#030303] group hover:bg-[#070707] transition-colors duration-300 border-[0.5px] border-transparent hover:border-white/5 min-h-48"
                            >
                                <div>
                                    <div className="flex justify-between items-center gap-2 mb-4">
                                        <span className="text-[8px] font-mono text-zinc-500 tracking-widest select-none">
                                            CAMPAIGN {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className={cn(
                                            "text-[9px] font-mono border-[0.5px] px-1.5 py-0.5 uppercase tracking-wider",
                                            isActive
                                                ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                                                : "border-zinc-500/20 text-zinc-400 bg-zinc-500/5"
                                        )}>
                                            {campaign.status.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="text-[13px] font-medium text-white group-hover:text-zinc-200 transition-colors truncate">
                                            {campaign.name}
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 font-sans line-clamp-2 leading-relaxed min-h-[32px]">
                                            {campaign.description || "No description configured."}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-0.5">
                                            <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500">Target Size</span>
                                            <div className="text-sm font-mono text-zinc-200">{leadCount}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500">Processed</span>
                                            <div className="text-sm font-mono text-zinc-200">{completedCount}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
                                            <span>Pipeline Completion</span>
                                            <span className="text-zinc-300">{completionRate}%</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-[2px]">
                                            <div className="h-full bg-zinc-400" style={{ width: `${completionRate}%` }} />
                                        </div>
                                    </div>

                                    <Link href={`/campaigns/${campaign.id}/edit`}>
                                        <button className="w-full h-8 flex items-center justify-center text-[10px] font-mono uppercase tracking-wider border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                                            Edit
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
