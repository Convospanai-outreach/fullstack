import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChevronDown, Globe, Mail, Search, UserPlus, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

function intentTier(intentScore?: number | null) {
    const score = intentScore ?? 0;
    if (score >= 0.7) return { label: "HOT", className: "text-destructive border-destructive/25 bg-destructive/5" };
    if (score >= 0.4) return { label: "WARM", className: "text-warning border-warning/25 bg-warning/5" };
    return { label: "COLD", className: "text-primary border-primary/25 bg-primary/5" };
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <SectionHeader
                    title="Leads"
                    subtitle="Track customer signal captures, queue metadata enrichment states, and review automated outreach transitions."
                />

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href="/leads/import"
                        id="import-csv-btn"
                        className="h-9 border border-input rounded-md px-4 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
                    >
                        Import CSV
                    </Link>

                    <Link href="/leads/new" id="add-lead-btn">
                        <button className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 px-4 text-xs font-medium rounded-md shadow-sm transition-all flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Add Lead
                        </button>
                    </Link>
                </div>
            </div>

            <form className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            name="search"
                            placeholder="Search by name, email, or domain..."
                            className="w-full bg-background border border-input rounded-md pl-10 pr-4 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                            defaultValue={search}
                            id="lead-search-input"
                        />
                    </div>

                    <div className="relative md:w-48">
                        <select
                            name="status"
                            defaultValue={status}
                            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium text-foreground outline-none appearance-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
                            id="lead-status-select"
                        >
                            <option value="">All Statuses</option>
                            <option value="NEW">New</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="CONNECTED">Engaged</option>
                            <option value="REPLIED">Replied</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <button className="h-9 border border-input rounded-md px-5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                        Search
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/50">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Channel Mode</span>
                    <div className="relative">
                        <select
                            name="channelFilter"
                            defaultValue={channelFilter}
                            className="bg-transparent text-xs text-foreground outline-none appearance-none pr-6 cursor-pointer hover:text-foreground/80 transition-colors"
                            id="lead-channel-select"
                        >
                            <option value="">All outreach channels</option>
                            <option value="linkedin_captured_not_contacted">LI captured | Uncontacted</option>
                        </select>
                        <ChevronDown className="absolute right-0 top-1 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{total} records</span>
                </div>
            </form>

            {unauthorized ? (
                <div className="text-center py-16 rounded-lg border border-dashed border-border bg-card">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Sign In Required</h3>
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center py-16 rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 text-muted-foreground mb-4 stroke-[1.5]" />
                    <h3 className="text-sm font-semibold text-foreground tracking-wide">No Leads Found</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm font-sans leading-relaxed">
                        No active records match the current filter set. Import new targets via CSV or add a lead to get started.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leads.map((lead, index) => {
                        const tier = intentTier(lead.intentScore);
                        return (
                        <Link
                            key={lead.id}
                            href={`/leads/${lead.id}`}
                            id={`lead-card-${index}`}
                            className="relative flex flex-col justify-between p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-all duration-200 group min-h-48"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-4">
                                    <div className="w-9 h-9 bg-muted border border-border flex items-center justify-center text-muted-foreground font-mono text-xs select-none rounded-md">
                                        {lead.fullName?.[0] || lead.email?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider bg-muted text-muted-foreground border-border">
                                            {displayLeadStatus(lead.status)}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider ${tier.className}`}>
                                            {tier.label} · {Math.round((lead.intentScore ?? 0) * 100)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                        {lead.fullName || "Unnamed Lead"}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
                                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="truncate">{lead.company || "Independent"}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
                                    <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
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
