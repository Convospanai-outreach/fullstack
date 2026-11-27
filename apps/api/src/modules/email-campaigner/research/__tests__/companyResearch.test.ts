import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findUnique, update, deduct, refund } = vi.hoisted(() => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    deduct: vi.fn(),
    refund: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findMany, findUnique, update } } }));
vi.mock("@/lib/credits", () => ({ deductCredits: deduct, refundCredits: refund }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { buildResearch, COMPANY_RESEARCH_CREDITS, getCompanyResearch, parseRelativeDate } from "../companyResearch";

const now = new Date("2026-11-27T12:00:00Z");
const args = { teamId: "team-1", leadId: "lead-1", domain: "www.Acme.com", company: "Acme" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const scrapeBody = {
    success: true,
    data: {
        json: {
            sells: "Warehouse robotics for logistics firms.",
            buyerQuestion: "How long does integration take?",
            latestPosts: [
                { title: "Our Pune launch", url: "/blog/pune", date: "2026-11-10" },
                { title: "Off-site post", url: "https://evil.example/x", date: "2026-11-11" },
                { title: "Undated post", url: "/blog/undated", date: "" },
            ],
        },
    },
};
const searchBody = {
    success: true,
    data: {
        news: [
            { title: "Acme raises funding", url: "https://news.example/a", snippet: "Acme, a robotics firm", date: "2 days ago" },
            { title: "Unrelated company news", url: "https://news.example/b", snippet: "Other Inc", date: "1 day ago" },
        ],
    },
};

const saved = { ...process.env };
beforeEach(() => {
    vi.clearAllMocks();
    process.env["FIRECRAWL_API_KEY"] = "fc-test";
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue({ enrichedData: { netjana: { a: 1 } } });
    update.mockResolvedValue({});
    deduct.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).endsWith("/scrape") ? json(scrapeBody) : json(searchBody))));
});
afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
});

describe("parseRelativeDate", () => {
    it("turns relative and absolute dates into YYYY-MM-DD", () => {
        expect(parseRelativeDate("2 days ago", now)).toBe("2026-11-25");
        expect(parseRelativeDate("3 weeks ago", now)).toBe("2026-11-06");
        expect(parseRelativeDate("yesterday", now)).toBe("2026-11-26");
        expect(parseRelativeDate("2026-11-10", now)).toBe("2026-11-10");
    });
    it("returns null for unreadable or future dates", () => {
        expect(parseRelativeDate("", now)).toBeNull();
        expect(parseRelativeDate("sometime", now)).toBeNull();
        expect(parseRelativeDate("2027-06-01", now)).toBeNull();
    });
});

describe("buildResearch", () => {
    const built = buildResearch({ domain: "acme.com", company: "Acme", now, scrape: scrapeBody.data.json, news: searchBody.data.news });
    it("keeps dated same-site posts and news about the company, newest first", () => {
        expect(built.facts.map((f) => f.title)).toEqual(["Acme raises funding", "Our Pune launch"]);
        expect(built.facts[1]!.url).toBe("https://acme.com/blog/pune");
    });
    it("carries the source URL and an absolute date on every fact", () => {
        for (const f of built.facts) {
            expect(f.url).toMatch(/^https:\/\//);
            expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });
});

describe("getCompanyResearch", () => {
    it("charges once, pulls, and stores the result on the lead without dropping other enrichment", async () => {
        const out = await getCompanyResearch(args, now);
        expect(out.status).toBe("ok");
        expect(deduct).toHaveBeenCalledWith("team-1", COMPANY_RESEARCH_CREDITS, "Company research (Firecrawl): acme.com", expect.any(Object));
        const saved = update.mock.calls[0]![0].data.enrichedData;
        expect(saved.netjana).toEqual({ a: 1 });
        expect(saved.research.domain).toBe("acme.com");
        expect(saved.research.buyerQuestion).toContain("integration");
    });

    it("charges nothing and calls nothing when the team already has fresh research for the domain", async () => {
        findMany.mockResolvedValue([{ enrichedData: { research: { domain: "acme.com", fetchedAt: "2026-11-20T00:00:00.000Z", sells: "x", buyerQuestion: "q", facts: [], firecrawlCredits: 7 } } }]);
        const out = await getCompanyResearch(args, now);
        expect(out).toMatchObject({ status: "ok", cached: true });
        expect(deduct).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("looks only inside the same team", async () => {
        await getCompanyResearch(args, now);
        expect(findMany.mock.calls[0]![0].where).toEqual({ teamId: "team-1", domain: "acme.com" });
    });

    it("pulls again when the stored research is older than 14 days", async () => {
        findMany.mockResolvedValue([{ enrichedData: { research: { domain: "acme.com", fetchedAt: "2026-11-01T00:00:00.000Z" } } }]);
        const out = await getCompanyResearch(args, now);
        expect(out).toMatchObject({ status: "ok", cached: false });
        expect(deduct).toHaveBeenCalledTimes(1);
    });

    it("refunds when the pull fails", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => json({ success: false, error: "Payment Required" }, 402)));
        const out = await getCompanyResearch(args, now);
        expect(out.status).toBe("failed");
        expect(refund).toHaveBeenCalledWith("team-1", COMPANY_RESEARCH_CREDITS, "Refund: Company research (Firecrawl): acme.com", expect.any(Object));
        expect(update).not.toHaveBeenCalled();
    });

    it("does not call Firecrawl when the team cannot pay", async () => {
        deduct.mockResolvedValue(false);
        const out = await getCompanyResearch(args, now);
        expect(out.status).toBe("no_credits");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("skips leads without a usable domain, and servers without a key, without charging", async () => {
        expect((await getCompanyResearch({ ...args, domain: "localhost" }, now)).status).toBe("no_domain");
        expect((await getCompanyResearch({ ...args, domain: null }, now)).status).toBe("no_domain");
        delete process.env["FIRECRAWL_API_KEY"];
        expect((await getCompanyResearch(args, now)).status).toBe("not_configured");
        expect(deduct).not.toHaveBeenCalled();
    });
});
