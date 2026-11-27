import { prisma } from "@/lib/db";
import { deductCredits, refundCredits } from "@/lib/credits";
import { logger } from "@/lib/logger";
import { firecrawlConfigured, firecrawlPost, FirecrawlError } from "./firecrawl";

// Company research for the email composer: what the prospect's company sells, its latest news and
// posts, and one question its buyers ask, every item with its source URL and date. Public company
// information only, from the company's own site and news search; nothing about the person.
//
// Off unless COMPANY_RESEARCH=on AND the campaign has turned it on (aiConfig.companyResearch).
//
// Billing: one fixed charge per company pulled fresh, free when the same team already has research
// for that domain younger than RESEARCH_TTL_DAYS. The charge is reserved before the pull and
// refunded if the pull fails. It is NOT Firecrawl's own unit: a Firecrawl credit costs about a
// tenth of a cent and a pull uses about 7, so passing them through 1:1 would take a free team's
// whole month in a few leads. apps/web/src/lib/companyResearch.ts shows the same number.

export const COMPANY_RESEARCH_CREDITS = 1;
export const RESEARCH_TTL_DAYS = 14;
/** A news item or post this old or newer counts as a fresh fact. */
export const FRESH_DAYS = 180;
// Firecrawl units a pull uses: scrape with JSON extraction (1 + 4) plus a news search (2 per 10 results).
const FIRECRAWL_CREDITS_PER_PULL = 7;
const dayMs = 86_400_000;

export function researchEnabled(): boolean {
    return process.env["COMPANY_RESEARCH"] === "on";
}

export interface ResearchFact {
    kind: "news" | "post";
    title: string;
    url: string;
    /** YYYY-MM-DD */
    date: string;
}

export interface CompanyResearch {
    domain: string;
    fetchedAt: string;
    sells: string;
    buyerQuestion: string;
    facts: ResearchFact[];
    firecrawlCredits: number;
}

export type ResearchResult =
    | { status: "ok"; research: CompanyResearch; cached: boolean }
    | { status: "no_domain" | "not_configured" | "no_credits" | "failed"; reason: string };

// ─── Parsing (pure) ─────────────────────────────────────────────

const UNITS: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: dayMs, week: 7 * dayMs, month: 30 * dayMs, year: 365 * dayMs };

/** Firecrawl returns news dates as text ("2 days ago"); store an absolute date. Null when unreadable. */
export function parseRelativeDate(raw: unknown, now: Date): string | null {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const text = raw.trim().toLowerCase();
    let at: number;
    const rel = text.match(/^(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago$/);
    if (rel) at = now.getTime() - Number(rel[1]) * UNITS[rel[2]!]!;
    else if (text === "yesterday") at = now.getTime() - dayMs;
    else if (text === "today") at = now.getTime();
    else at = Date.parse(raw);
    if (!Number.isFinite(at) || at > now.getTime() + dayMs) return null;
    return new Date(at).toISOString().slice(0, 10);
}

const clean = (value: unknown, max: number) =>
    typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const hostOf = (value: string) => value.toLowerCase().replace(/^www\./, "");

export interface ScrapeJson {
    sells?: unknown;
    buyerQuestion?: unknown;
    latestPosts?: Array<{ title?: unknown; url?: unknown; date?: unknown }> | unknown;
}
export interface NewsItem {
    title?: unknown;
    url?: unknown;
    snippet?: unknown;
    date?: unknown;
}

export function buildResearch(input: { domain: string; company: string; now: Date; scrape: ScrapeJson | null; news: NewsItem[] }): CompanyResearch {
    const { domain, company, now } = input;
    const facts = new Map<string, ResearchFact>();

    const posts = Array.isArray(input.scrape?.latestPosts) ? (input.scrape!.latestPosts as Array<{ title?: unknown; url?: unknown; date?: unknown }>) : [];
    for (const post of posts) {
        const title = clean(post.title, 160);
        const date = parseRelativeDate(post.date, now);
        let url: URL;
        try {
            url = new URL(String(post.url ?? ""), `https://${domain}`);
        } catch {
            continue;
        }
        const sameSite = hostOf(url.hostname) === domain || hostOf(url.hostname).endsWith(`.${domain}`);
        if (title && date && sameSite && url.protocol === "https:") facts.set(url.href, { kind: "post", title, url: url.href, date });
    }

    const name = company.trim().toLowerCase();
    for (const item of input.news) {
        const title = clean(item.title, 160);
        const date = parseRelativeDate(item.date, now);
        let url: URL;
        try {
            url = new URL(String(item.url ?? ""));
        } catch {
            continue;
        }
        const about = `${title} ${clean(item.snippet, 300)}`.toLowerCase();
        if (title && date && url.protocol === "https:" && (!name || about.includes(name)) && !facts.has(url.href)) {
            facts.set(url.href, { kind: "news", title, url: url.href, date });
        }
    }

    return {
        domain,
        fetchedAt: now.toISOString(),
        sells: clean(input.scrape?.sells, 300),
        buyerQuestion: clean(input.scrape?.buyerQuestion, 200),
        facts: [...facts.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
        firecrawlCredits: FIRECRAWL_CREDITS_PER_PULL,
    };
}

// ─── The pull ───────────────────────────────────────────────────

const SCRAPE_SCHEMA = {
    type: "object",
    properties: {
        sells: { type: "string", description: "One or two sentences: what this company sells and to whom. Use only the page text." },
        buyerQuestion: {
            type: "string",
            description: "One question this company's customers commonly ask. Copy it from an FAQ on the page if there is one, otherwise infer it from the offer. Empty if unclear.",
        },
        latestPosts: {
            type: "array",
            maxItems: 5,
            description: "Latest blog or news posts listed on the page, newest first.",
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    date: { type: "string", description: "Publication date exactly as shown on the page. Empty if not shown." },
                },
            },
        },
    },
};

const VALID_DOMAIN = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

async function pull(domain: string, company: string, now: Date): Promise<CompanyResearch> {
    const [scrape, search] = await Promise.all([
        firecrawlPost<{ data?: { json?: ScrapeJson } }>("/scrape", {
            url: `https://${domain}`,
            formats: [{ type: "json", schema: SCRAPE_SCHEMA }],
            onlyMainContent: true,
            timeout: 20_000,
        }),
        company.trim()
            ? firecrawlPost<{ data?: { news?: NewsItem[] } }>("/search", {
                  query: `"${company.trim().slice(0, 120)}"`,
                  sources: [{ type: "news" }],
                  limit: 5,
                  tbs: "qdr:y",
                  timeout: 20_000,
              })
            : Promise.resolve(null),
    ]);
    return buildResearch({ domain, company, now, scrape: scrape.data?.json ?? null, news: search?.data?.news ?? [] });
}

// ─── Cache, billing, storage ────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);

function freshResearch(enrichedData: unknown, domain: string, now: Date): CompanyResearch | null {
    const research = isRecord(enrichedData) ? enrichedData["research"] : null;
    if (!isRecord(research) || research["domain"] !== domain || typeof research["fetchedAt"] !== "string") return null;
    return now.getTime() - Date.parse(research["fetchedAt"]) <= RESEARCH_TTL_DAYS * dayMs ? (research as CompanyResearch) : null;
}

export async function getCompanyResearch(
    args: { teamId: string; leadId: string; domain: string | null | undefined; company: string | null | undefined },
    now: Date = new Date(),
): Promise<ResearchResult> {
    const domain = hostOf(args.domain ?? "");
    if (!VALID_DOMAIN.test(domain)) return { status: "no_domain", reason: "The lead has no company website to research." };
    if (!firecrawlConfigured()) return { status: "not_configured", reason: "Company research is not set up on this server." };

    // Same team only: one team never gets research another team paid for.
    const known = await prisma.lead.findMany({ where: { teamId: args.teamId, domain }, orderBy: { updatedAt: "desc" }, take: 20, select: { enrichedData: true } });
    for (const lead of known) {
        const hit = freshResearch(lead.enrichedData, domain, now);
        if (hit) return { status: "ok", research: hit, cached: true };
    }

    const description = `Company research (Firecrawl): ${domain}`;
    const paid = await deductCredits(args.teamId, COMPANY_RESEARCH_CREDITS, description, { leadId: args.leadId, domain, firecrawlCredits: FIRECRAWL_CREDITS_PER_PULL });
    if (!paid) return { status: "no_credits", reason: `Not enough credits for company research (${COMPANY_RESEARCH_CREDITS} per new company).` };

    let research: CompanyResearch;
    try {
        research = await pull(domain, args.company ?? "", now);
    } catch (error) {
        await refundCredits(args.teamId, COMPANY_RESEARCH_CREDITS, `Refund: ${description}`, { leadId: args.leadId, domain });
        const reason = error instanceof FirecrawlError && error.status === 402 ? "The research provider has run out of credits." : "The company research could not be fetched.";
        logger.warn("[company research] pull failed", { domain, error: error instanceof Error ? error.message : String(error) });
        return { status: "failed", reason };
    }

    try {
        const current = await prisma.lead.findUnique({ where: { id: args.leadId }, select: { enrichedData: true } });
        const base = isRecord(current?.enrichedData) ? current!.enrichedData : {};
        await prisma.lead.update({ where: { id: args.leadId }, data: { enrichedData: { ...base, research } as any } });
    } catch (error) {
        // The pull was paid for and worked; failing to cache it only means the next lead pays again.
        logger.warn("[company research] could not store the result", { domain, error: error instanceof Error ? error.message : String(error) });
    }
    return { status: "ok", research, cached: false };
}
