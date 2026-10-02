import { prisma } from "@/lib/db";
import { FUNNEL_STAGE_ORDER } from "./funnelStageService";

// Content ROI: what each published post brought in (creator funnel 6c).
// - Visits: distinct landing page sessions whose URL had utm_content=<post> (event time in window).
// - Opt-ins: landing sign-ups whose URL had utm_content=<post> (sign-up time in window).
// - Purchases / revenue: paid orders from checkouts started in the window, credited to the order's
//   own utm_content post, or else the buyer lead's first-touch post (Lead.firstTouchPostId).
//   Each order counts once. A buyer who pays with a different email than they opted in with has no
//   lead link and stays unattributed.
// - Stage conversion: of the leads that reached a stage in the window, how many also reached the
//   next one (from the stage_change activity log, so leads that skip a stage aren't counted as
//   having passed through it).

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POSTS = 200;
const MAX_ORDERS = 5000;
const MAX_STAGE_ROWS = 20000;

/**
 * Records the post that first brought a lead in. Only a ContentPost of the lead's own team is
 * accepted (utm_content is public input, and also carries sequence step ids), and only once.
 */
export async function setFirstTouchPost(teamId: string, leadId: string, postId: string | null | undefined) {
    if (!postId) return false;
    const post = await prisma.contentPost.findFirst({ where: { id: postId, teamId }, select: { id: true } });
    if (!post) return false;
    const updated = await prisma.lead.updateMany({ where: { id: leadId, teamId, firstTouchPostId: null }, data: { firstTouchPostId: post.id } });
    return updated.count === 1;
}

type Money = { currency: string; amount: number }; // amount in the smallest unit (paise / cents)

function addMoney(list: Money[], currency: string, amount: number) {
    const found = list.find((m) => m.currency === currency);
    if (found) found.amount += amount;
    else list.push({ currency, amount });
}

export async function getContentRoi(teamId: string, days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * DAY_MS);

    const posts = await prisma.contentPost.findMany({
        where: { teamId, targets: { some: { status: "PUBLISHED" } } },
        select: {
            id: true,
            body: true,
            funnelStage: true,
            targets: {
                where: { status: "PUBLISHED" },
                select: { publishedAt: true, socialAccount: { select: { platform: true, handle: true } } },
            },
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_POSTS,
    });
    const postIds = posts.map((post) => post.id);
    const isPost = new Set(postIds);

    const [sessions, optIns, orders, stageRows] = await Promise.all([
        postIds.length
            ? prisma.landingEvent.groupBy({
                  by: ["utmContent", "sessionId"],
                  where: { teamId, eventName: "page_view", createdAt: { gte: since }, utmContent: { in: postIds } },
                  _count: { _all: true },
              })
            : [],
        postIds.length
            ? prisma.landingLead.groupBy({
                  by: ["utmContent"],
                  where: { teamId, createdAt: { gte: since }, utmContent: { in: postIds } },
                  _count: { _all: true },
              })
            : [],
        prisma.order.findMany({
            where: { teamId, status: "CAPTURED", createdAt: { gte: since } },
            select: { amount: true, currency: true, utmContent: true, lead: { select: { firstTouchPostId: true } } },
            take: MAX_ORDERS,
        }),
        prisma.leadActivity.findMany({
            where: { type: "stage_change", channel: "funnel", createdAt: { gte: since }, lead: { teamId } },
            select: { leadId: true, metadata: true },
            take: MAX_STAGE_ROWS,
        }),
    ]);

    const stats = new Map(postIds.map((id) => [id, { visits: 0, optIns: 0, purchases: 0, revenue: [] as Money[] }]));
    for (const row of sessions) {
        // A session id counts once; events without one count individually.
        const entry = row.utmContent ? stats.get(row.utmContent) : undefined;
        if (entry) entry.visits += row.sessionId ? 1 : row._count._all;
    }
    for (const row of optIns) {
        const entry = row.utmContent ? stats.get(row.utmContent) : undefined;
        if (entry) entry.optIns += row._count._all;
    }
    const unattributed = { purchases: 0, revenue: [] as Money[] };
    const totalRevenue: Money[] = [];
    for (const order of orders) {
        const postId = order.utmContent && isPost.has(order.utmContent)
            ? order.utmContent
            : order.lead?.firstTouchPostId && isPost.has(order.lead.firstTouchPostId)
              ? order.lead.firstTouchPostId
              : null;
        const entry = postId ? stats.get(postId)! : unattributed;
        entry.purchases += 1;
        addMoney(entry.revenue, order.currency, order.amount);
        addMoney(totalRevenue, order.currency, order.amount);
    }

    // Posts are ranked by revenue in the team's main currency (the one with the most revenue),
    // then by purchases, opt-ins and visits.
    const mainCurrency = [...totalRevenue].sort((a, b) => b.amount - a.amount)[0]?.currency ?? null;
    const inMain = (revenue: Money[]) => revenue.find((m) => m.currency === mainCurrency)?.amount ?? 0;
    const rows = posts
        .map((post) => {
            const s = stats.get(post.id)!;
            const publishedAt = post.targets.map((t) => t.publishedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
            return {
                id: post.id,
                excerpt: post.body.replace(/\s+/g, " ").trim().slice(0, 120),
                funnelStage: post.funnelStage,
                channels: post.targets.map((t) => ({ platform: t.socialAccount.platform, handle: t.socialAccount.handle })),
                publishedAt,
                ...s,
            };
        })
        .sort((a, b) => inMain(b.revenue) - inMain(a.revenue) || b.purchases - a.purchases || b.optIns - a.optIns || b.visits - a.visits);

    const reached = new Map(FUNNEL_STAGE_ORDER.map((stage) => [stage, new Set<string>()]));
    for (const row of stageRows) {
        const to = (row.metadata as { to?: string } | null)?.to;
        const set = to ? reached.get(to as (typeof FUNNEL_STAGE_ORDER)[number]) : undefined;
        if (set) set.add(row.leadId);
    }
    const stages = FUNNEL_STAGE_ORDER.slice(0, -1).map((from, i) => {
        const to = FUNNEL_STAGE_ORDER[i + 1]!;
        const fromSet = reached.get(from)!;
        const toSet = reached.get(to)!;
        const converted = [...fromSet].filter((leadId) => toSet.has(leadId)).length;
        return { from, to, reached: fromSet.size, converted, rate: fromSet.size ? converted / fromSet.size : null };
    });

    return { days, since, mainCurrency, posts: rows, stages, unattributed, totalRevenue };
}
