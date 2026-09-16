import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChevronDown, Search, UserPlus, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import LeadsSelectionGrid from "@/components/leads/LeadsSelectionGrid";

const PIPELINE_STAGES = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED", "CLOSED_WON", "CLOSED_LOST"];

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

async function loadLeads(searchParams: PageSearchParams) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return { leads: [], total: 0, unauthorized: true };

    const search = firstParam(searchParams["search"]).trim();
    const status = firstParam(searchParams["status"]).trim();
    const channelFilter = firstParam(searchParams["channelFilter"]).trim();
    const company = firstParam(searchParams["company"]).trim();
    const jobTitle = firstParam(searchParams["jobTitle"]).trim();
    const pipelineState = firstParam(searchParams["pipelineState"]).trim();
    const clusterLabel = firstParam(searchParams["clusterLabel"]).trim();
    const minIcpFitScore = firstParam(searchParams["minIcpFitScore"]).trim();
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
    if (company) where.company = { contains: company, mode: "insensitive" };
    if (jobTitle) where.jobTitle = { contains: jobTitle, mode: "insensitive" };
    if (pipelineState) where.pipelineState = pipelineState;
    if (clusterLabel) where.clusterLabel = clusterLabel;
    if (minIcpFitScore && !Number.isNaN(Number(minIcpFitScore))) {
        where.icpFitScore = { gte: Number(minIcpFitScore) };
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
    const company = firstParam(params["company"]);
    const jobTitle = firstParam(params["jobTitle"]);
    const pipelineState = firstParam(params["pipelineState"]);
    const clusterLabel = firstParam(params["clusterLabel"]);
    const minIcpFitScore = firstParam(params["minIcpFitScore"]);
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

                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        name="company"
                        placeholder="Filter by company..."
                        defaultValue={company}
                        className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                        id="lead-company-input"
                    />
                    <input
                        type="text"
                        name="jobTitle"
                        placeholder="Filter by job title..."
                        defaultValue={jobTitle}
                        className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                        id="lead-jobtitle-input"
                    />
                    <div className="relative md:w-56">
                        <select
                            name="pipelineState"
                            defaultValue={pipelineState}
                            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium text-foreground outline-none appearance-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
                            id="lead-pipeline-select"
                        >
                            <option value="">All funnel stages</option>
                            {PIPELINE_STAGES.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <div className="relative md:w-48">
                        <select
                            name="clusterLabel"
                            defaultValue={clusterLabel}
                            className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium text-foreground outline-none appearance-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
                            id="lead-cluster-select"
                        >
                            <option value="">All cohorts</option>
                            <option value="HIGH_VALUE">High value</option>
                            <option value="AT_RISK">At risk</option>
                            <option value="DORMANT">Dormant</option>
                            <option value="NEW">New</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <input
                        type="number"
                        name="minIcpFitScore"
                        min={0}
                        max={100}
                        placeholder="Min. ICP fit %"
                        defaultValue={minIcpFitScore}
                        className="md:w-36 bg-background border border-input rounded-md px-3 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                        id="lead-icp-fit-input"
                    />
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
                <LeadsSelectionGrid leads={leads} />
            )}
        </div>
    );
}
