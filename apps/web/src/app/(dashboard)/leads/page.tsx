import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChevronDown, Globe, Mail, Search, UserPlus, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

function intentTier(intentScore?: number | null) {
    const score = intentScore ?? 0;
    if (score >= 0.7) return { label: "HOT", className: "text-red-400 border-red-500/25 bg-red-500/5" };
    if (score >= 0.4) return { label: "WARM", className: "text-amber-400 border-amber-500/25 bg-amber-500/5" };
    return { label: "COLD", className: "text-blue-400 border-blue-500/25 bg-blue-500/5" };
}

function displayLeadStatus(status?: string | null) {
    if (!status) return "NEW STATE";
    const labels: Record<string, string> = {
        NEW: "NEW LEAD",
        enriched: "ENRICHED",
        ENRICHED: "ENRICHED",
        CONTACTED: "CONTACTED",
        CONNECTED: "ENGAGED",
        REPLIED: "POS REPLY",
        CONVERTED: "CONVERTED",
        LOST: "LOST",
        STOPPED: "STOPPED",
    };
    return labels[status] ?? status.toUpperCase();
}

async function loadLeads(searchParams: PageSearchParams) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return { leads: [], total: 0, unauthorized: true };

    const search = firstParam(searchParams["search"]).trim();
    const status = firstParam(searchParams["status"]).trim();
    const channelFilter = firstParam(searchParams["channelFilter"]).trim();
    const where: any = { teamId };

    if (search) {
        where.OR = [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
        ];
    }
    if (status) where.status = status;
    if (channelFilter === "linkedin_captured_not_contacted") {
        where.channelStatuses = { some: { channel: "LINKEDIN", status: { in: ["CAPTURED", "DRAFTED"] } } };
    }

    const [leads, total] = await Promise.all([
        prisma.lead.findMany({
            where,
            take: 100,
            orderBy: { updatedAt: "desc" },
            include: { channelStatuses: true },
        }),
        prisma.lead.count({ where }),
    ]);

    return { leads, total, unauthorized: false };
}

export default async function LeadsPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
    const params = (await searchParams) || {};
    const search = firstParam(params["search"]);
    const status = firstParam(params["status"]);
    const channelFilter = firstParam(params["channelFilter"]);
    const { leads, total, unauthorized } = await loadLeads(params);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-xl font-normal text-white font-outfit tracking-tight flex items-center gap-2">
                        <span className="text-zinc-600 font-mono text-sm">[01]</span>
                        Lead Registry
                    </h1>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-xl font-sans leading-relaxed">
                        Track customer signal captures, queue metadata enrichment states, and review automated outreach transitions.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href="/leads/import"
                        id="import-csv-btn"
                        className="h-8 border border-white/10 bg-white/2 px-3 text-[11px] font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                    >
                        Import CSV
                    </Link>

                    <Link
                        href="/leads/new"
                        id="add-lead-btn"
                        className="h-8 bg-zinc-100 hover:bg-white px-3 text-[11px] font-medium text-zinc-950 transition-colors flex items-center gap-2"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Lead
                    </Link>
                </div>
            </div>

            <form className="bg-[#030303] border-[0.5px] border-white/10 p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                        <input
                            type="text"
                            name="search"
                            placeholder="QUERY REGISTRY: Search by name, email, or domain..."
                            className="w-full bg-[#060606] border border-white/10 pl-9 pr-4 py-2 text-[12.5px] font-mono placeholder:text-zinc-600 text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
                            defaultValue={search}
                            id="lead-search-input"
                        />
                    </div>

                    <div className="relative md:w-48">
                        <select
                            name="status"
                            defaultValue={status}
                            className="w-full bg-[#060606] border border-white/10 px-3 py-2 text-[12px] font-mono text-zinc-300 outline-none appearance-none focus:border-zinc-500 transition-colors cursor-pointer"
                            id="lead-status-select"
                        >
                            <option value="">ALL STATUSES</option>
                            <option value="NEW">NEW STATE</option>
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="CONNECTED">ENGAGED</option>
                            <option value="REPLIED">REPLIED</option>
                            <option value="INTERESTED">INTERESTED</option>
                            <option value="NOT_INTERESTED">NOT INTERESTED</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 h-3 w-3 text-zinc-500 pointer-events-none" />
                    </div>
                    <button className="h-9 border border-white/10 px-4 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors">
                        Search
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Channel Mode</span>
                    <div className="relative">
                        <select
                            name="channelFilter"
                            defaultValue={channelFilter}
                            className="bg-transparent text-[11px] font-mono text-zinc-400 outline-none appearance-none pr-6 cursor-pointer hover:text-zinc-200 transition-colors"
                            id="lead-channel-select"
                        >
                            <option value="" className="bg-[#030303] text-zinc-400">All outreach channels</option>
                            <option value="linkedin_captured_not_contacted" className="bg-[#030303] text-zinc-400">LI captured | Uncontacted</option>
                        </select>
                        <ChevronDown className="absolute right-0 top-1 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                    </div>
                    <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-zinc-500">{total} records</span>
                </div>
            </form>

            {unauthorized ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2">
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">Sign In Required</h3>
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2 flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 text-zinc-600 mb-4 stroke-[1]" />
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">No Leads Registered</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm font-sans">
                        No active records match the current filter set. Import new targets via CSV or add a lead to get started.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    {leads.map((lead, index) => {
                        const tier = intentTier(lead.intentScore);
                        return (
                        <Link
                            key={lead.id}
                            href={`/leads/${lead.id}`}
                            id={`lead-card-${index}`}
                            className="relative flex flex-col justify-between p-5 bg-[#030303] group hover:bg-[#070707] transition-colors duration-300 min-h-48"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-4">
                                    <div className="w-9 h-9 bg-white/2 border border-white/10 flex items-center justify-center text-zinc-400 font-mono text-xs select-none">
                                        {lead.fullName?.[0] || lead.email?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[9px] font-mono border-[0.5px] border-white/10 px-1.5 py-0.5 text-zinc-400 bg-white/2 uppercase tracking-wide">
                                            {displayLeadStatus(lead.status)}
                                        </span>
                                        <span className={`text-[8.5px] font-mono border-[0.5px] px-1.5 py-0.5 uppercase tracking-wide ${tier.className}`}>
                                            {tier.label} · {Math.round((lead.intentScore ?? 0) * 100)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-[13px] font-medium text-white group-hover:text-zinc-200 transition-colors truncate">
                                        {lead.fullName || "Unnamed Lead"}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                                        <Globe className="w-3 h-3 text-zinc-600" />
                                        <span className="truncate">{lead.company || "INDEPENDENT"}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 font-mono">
                                    <Mail className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                                    <span className="truncate">{lead.email}</span>
                                </div>
                            </div>
                        </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
