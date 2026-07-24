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
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-outfit tracking-tight flex items-center gap-2">
                        Outreach Campaigns
                    </h1>
                    <p className="text-xs text-text-secondary mt-1 max-w-xl font-sans leading-relaxed">
                        Deploy customer outreach sequences, monitor execution telemetry, and manage automated workflow configurations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton type="campaigns" />

                    <Link href="/campaigns/new" id="create-campaign-btn">
                        <button className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 px-4 text-xs font-medium rounded-md shadow-sm transition-all flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Create Campaign
                        </button>
                    </Link>
                </div>
            </div>

            <form className="bg-card border border-border/50 rounded-lg p-4 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        name="search"
                        placeholder="Search by campaign name or description..."
                        className="w-full bg-background border border-input rounded-md pl-10 pr-4 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                        defaultValue={search}
                        id="campaign-search-input"
                    />
                </div>

                <div className="relative md:w-52">
                    <select
                        name="status"
                        defaultValue={status}
                        className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium text-foreground outline-none appearance-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
                        id="campaign-status-select"
                    >
                        <option value="">All Campaigns</option>
                        <option value="active">Active Only</option>
                        <option value="paused">Paused Only</option>
                        <option value="draft">Drafts Only</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <button className="h-9 border border-input rounded-md px-5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                    Search
                </button>
            </form>

            {unauthorized ? (
                <div className="text-center py-16 rounded-lg border border-dashed border-border/50 bg-card/40">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Sign In Required</h3>
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-16 rounded-lg border border-dashed border-border/50 bg-card/40 flex flex-col items-center justify-center">
                    <Megaphone className="w-10 h-10 text-muted-foreground mb-4 stroke-[1.5]" />
                    <h3 className="text-sm font-semibold text-foreground tracking-wide">No Campaigns Found</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm font-sans leading-relaxed">
                        No sequences match your search criteria. Create an outreach campaign to start queueing contacts.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map((campaign, index) => {
                        const isActive = campaign.status === "active";
                        const leadCount = campaign._count?.leadList || campaign.leads || 0;
                        const completedCount = campaign.completedCount || 0;
                        const completionRate = leadCount > 0 ? Math.round((completedCount / leadCount) * 100) : 0;

                        return (
                            <div
                                key={campaign.id}
                                className="relative flex flex-col justify-between p-6 bg-card rounded-lg border border-border/50 hover:border-primary/50 transition-all duration-200 shadow-sm group min-h-56"
                            >
                                <div>
                                    <div className="flex justify-between items-center gap-2 mb-4">
                                        <span className="text-[10px] font-mono text-muted-foreground tracking-wider select-none uppercase">
                                            Campaign {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider",
                                            isActive
                                                ? "bg-success/10 text-success border-success/20"
                                                : "bg-muted text-muted-foreground border-border"
                                        )}>
                                            {campaign.status}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                                            {campaign.name}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-sans line-clamp-2 leading-relaxed min-h-[36px]">
                                            {campaign.description || "No description configured."}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Target Size</span>
                                            <div className="text-base font-bold text-slate-200">{leadCount}</div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Processed</span>
                                            <div className="text-base font-bold text-slate-200">{completedCount}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                            <span>Pipeline Completion</span>
                                            <span className="text-indigo-400">{completionRate}%</span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                                        </div>
                                    </div>

                                    <Link href={`/campaigns/${campaign.id}/edit`}>
                                        <button className="w-full h-9 flex items-center justify-center text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all">
                                            Edit Campaign
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
