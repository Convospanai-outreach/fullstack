import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Building2, ChevronRight, Search, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || "" : value || "";
}

interface Account {
    key: string; // domain when present, otherwise company name
    label: string;
    domain: string | null;
    company: string | null;
    leadCount: number;
}

async function loadAccounts(search: string): Promise<{ accounts: Account[]; unauthorized: boolean }> {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return { accounts: [], unauthorized: true };

    const where: any = { teamId, OR: [{ domain: { not: null } }, { company: { not: null } }] };
    if (search) {
        where.AND = [
            {
                OR: [
                    { company: { contains: search, mode: "insensitive" } },
                    { domain: { contains: search, mode: "insensitive" } },
                ],
            },
        ];
    }

    // Leads are grouped client-side (not via prisma groupBy) because an account
    // is keyed by domain when present but falls back to company name when it's
    // not (many CSV imports have a company but no normalized domain yet).
    const leads = await prisma.lead.findMany({
        where,
        select: { domain: true, company: true },
        take: 5000,
    });

    const byKey = new Map<string, Account>();
    for (const lead of leads) {
        const key = lead.domain || lead.company;
        if (!key) continue;
        const existing = byKey.get(key);
        if (existing) {
            existing.leadCount += 1;
        } else {
            byKey.set(key, {
                key,
                label: lead.company || lead.domain || key,
                domain: lead.domain,
                company: lead.company,
                leadCount: 1,
            });
        }
    }

    const accounts = Array.from(byKey.values()).sort((a, b) => b.leadCount - a.leadCount);
    return { accounts, unauthorized: false };
}

export default async function AccountsPage({
    searchParams,
}: {
    searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
    const params = (await searchParams) || {};
    const search = firstParam(params["search"]).trim();
    const { accounts, unauthorized } = await loadAccounts(search);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <SectionHeader
                title="Accounts"
                subtitle="Leads grouped by company, so you can map an org chart and target a whole account at once."
            />

            <form className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                <div className="relative">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        name="search"
                        placeholder="Search by company or domain..."
                        defaultValue={search}
                        className="w-full bg-background border border-input rounded-md pl-10 pr-4 py-1.5 text-xs font-medium placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-ring transition-colors"
                    />
                </div>
            </form>

            {unauthorized ? (
                <div className="text-center py-16 rounded-lg border border-dashed border-border bg-card">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Sign In Required</h3>
                </div>
            ) : accounts.length === 0 ? (
                <div className="text-center py-16 rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center">
                    <Building2 className="w-10 h-10 text-muted-foreground mb-4 stroke-[1.5]" />
                    <h3 className="text-sm font-semibold text-foreground tracking-wide">No Accounts Yet</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm font-sans leading-relaxed">
                        Import leads with a company or domain to see them grouped into accounts here.
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm divide-y divide-border">
                    {accounts.map((account) => (
                        <Link
                            key={account.key}
                            href={`/leads/org-chart?${account.domain ? `domain=${encodeURIComponent(account.domain)}` : `company=${encodeURIComponent(account.company || account.key)}`}`}
                            className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent transition-colors group"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground flex-shrink-0">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                        {account.label}
                                    </p>
                                    {account.domain && (
                                        <p className="text-xs text-muted-foreground truncate">{account.domain}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Users className="w-3.5 h-3.5" />
                                    {account.leadCount} lead{account.leadCount === 1 ? "" : "s"}
                                </span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
