import { z } from "zod";
import { prisma } from "@/lib/db";
import { ContentPostError } from "./contentPostService";
import { PRIVATE_SCOPES, PUBLIC_REPLY_SCOPE, REPLY_TEXT_MAX_BYTES, words } from "./keywordTriggers";
import type { AccountPlatform } from "./socialInbox";

// Create, edit, switch on/off and delete keyword auto-replies (keywordTriggers.ts sends them).
// A new trigger is saved switched off; switching it on is the person's approval for it to send
// on its own, and checks the account has the permissions those sends need.

const SOCIAL_PLATFORMS = ["INSTAGRAM", "FACEBOOK_PAGE"] as const;
const PUBLIC_REPLY_MAX = 500;
const STATS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const fields = {
    socialAccountId: z.string().max(64),
    scope: z.enum(["COMMENT", "DM", "BOTH"]),
    keywords: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
    match: z.enum(["EXACT", "CONTAINS"]),
    contentPostId: z.string().max(64).nullable(),
    replyText: z.string().trim().min(1).max(REPLY_TEXT_MAX_BYTES),
    publicCommentReply: z.string().trim().max(PUBLIC_REPLY_MAX).nullable(),
    landingPageId: z.string().max(64).nullable(),
};

export const createTriggerSchema = z.object({
    ...fields,
    scope: fields.scope.default("COMMENT"),
    match: fields.match.default("CONTAINS"),
    contentPostId: fields.contentPostId.default(null),
    publicCommentReply: fields.publicCommentReply.default(null),
    landingPageId: fields.landingPageId.default(null),
});
export const updateTriggerSchema = z.object({ ...fields, active: z.boolean() }).partial();

type TriggerFields = z.infer<typeof createTriggerSchema>;

const fail = (status: number, message: string): never => {
    throw new ContentPostError(status, message);
};

async function checkFields(teamId: string, input: TriggerFields) {
    const account = await prisma.socialAccount.findFirst({
        where: { id: input.socialAccountId, teamId, platform: { in: [...SOCIAL_PLATFORMS] } },
        select: { id: true, platform: true, status: true, scopes: true },
    });
    if (!account) fail(400, "Pick a connected Instagram account or Facebook Page.");

    if (input.keywords.some((keyword) => words(keyword).length === 0)) fail(400, "Keywords need at least one letter or number.");
    if (Buffer.byteLength(input.replyText, "utf8") > REPLY_TEXT_MAX_BYTES) {
        fail(400, `The reply can be at most ${REPLY_TEXT_MAX_BYTES} bytes, to leave room for the link (emoji and accented letters count as more than one).`);
    }

    if (input.contentPostId) {
        const post = await prisma.contentPost.findFirst({
            where: { id: input.contentPostId, teamId, targets: { some: { socialAccountId: input.socialAccountId, status: "PUBLISHED", externalId: { not: null } } } },
            select: { id: true },
        });
        if (!post) fail(400, "That post isn't live on this account.");
    }
    if (input.landingPageId) {
        const page = await prisma.landingPage.findFirst({ where: { id: input.landingPageId, teamId, status: "published" }, select: { id: true } });
        if (!page) fail(400, "Pick a published landing page.");
    }

    const { guardrailService } = await import("@/modules/governance/service/guardrailService");
    for (const text of [input.replyText, input.publicCommentReply]) {
        if (!text) continue;
        const validation = await guardrailService.evaluate(teamId, text);
        if (!validation.isSafe) fail(400, validation.violations[0]?.reason || "Blocked by your workspace's content rules.");
    }
    return account as NonNullable<typeof account>;
}

/** The permissions an active trigger needs on its account, for the sends it can make. */
export function neededScopes(platform: AccountPlatform, scope: TriggerFields["scope"], publicReply: boolean) {
    const kinds = scope === "BOTH" ? (["COMMENT", "DM"] as const) : ([scope] as const);
    const needed = new Set(kinds.flatMap((kind) => PRIVATE_SCOPES[kind][platform]));
    if (publicReply && scope !== "DM") needed.add(PUBLIC_REPLY_SCOPE[platform]);
    return [...needed];
}

function checkCanActivate(account: { platform: string; status: string; scopes: string[] }, input: TriggerFields) {
    if (account.status !== "CONNECTED") fail(409, "Reconnect this account in Settings before switching the auto-reply on.");
    const missing = neededScopes(account.platform as AccountPlatform, input.scope, Boolean(input.publicCommentReply)).filter(
        (scope) => !account.scopes.includes(scope)
    );
    if (missing.length) fail(409, `Reconnect this account and allow: ${missing.join(", ")}.`);
}

const normalize = (input: TriggerFields): TriggerFields => ({
    ...input,
    keywords: [...new Set(input.keywords.map((keyword) => keyword.trim()))],
    // A public reply only exists for comments.
    publicCommentReply: input.scope === "DM" ? null : input.publicCommentReply || null,
});

const TRIGGER_SELECT = {
    id: true,
    socialAccountId: true,
    scope: true,
    keywords: true,
    match: true,
    contentPostId: true,
    replyText: true,
    publicCommentReply: true,
    landingPageId: true,
    active: true,
    activatedAt: true,
    createdAt: true,
} as const;

export async function createTrigger(teamId: string, userId: string, raw: TriggerFields) {
    const input = normalize(raw);
    await checkFields(teamId, input);
    return prisma.keywordTrigger.create({ data: { teamId, ...input, active: false, createdById: userId }, select: TRIGGER_SELECT });
}

export async function updateTrigger(teamId: string, userId: string, id: string, patch: z.infer<typeof updateTriggerSchema>) {
    const existing = await prisma.keywordTrigger.findFirst({ where: { id, teamId }, select: TRIGGER_SELECT });
    if (!existing) fail(404, "Auto-reply not found");
    const current = existing as NonNullable<typeof existing>;
    const { active, ...changes } = patch;
    // Switching off never depends on anything else being valid (e.g. a content rule that now
    // blocks the reply, or a landing page that was unpublished).
    if (active === false && Object.keys(changes).length === 0) {
        return prisma.keywordTrigger.update({ where: { id: current.id }, data: { active: false }, select: TRIGGER_SELECT });
    }
    const input = normalize({ ...current, ...changes } as TriggerFields);
    const account = await checkFields(teamId, input);

    const turningOn = active === true && !current.active;
    if (active ?? current.active) checkCanActivate(account, input);

    return prisma.keywordTrigger.update({
        where: { id: current.id },
        data: {
            ...input,
            ...(active !== undefined ? { active } : {}),
            ...(turningOn ? { activatedById: userId, activatedAt: new Date() } : {}),
        },
        select: TRIGGER_SELECT,
    });
}

export async function deleteTrigger(teamId: string, id: string) {
    const deleted = await prisma.keywordTrigger.deleteMany({ where: { id, teamId } });
    if (deleted.count === 0) fail(404, "Auto-reply not found");
}

// The triggers with last week's numbers, plus what the editor offers: accounts, published
// landing pages, and posts live on an account (a trigger can be limited to one of them).
export async function listTriggers(teamId: string, now = new Date()) {
    const since = new Date(now.getTime() - STATS_WINDOW_MS);
    const [triggers, accounts, landingPages, posts] = await Promise.all([
        prisma.keywordTrigger.findMany({ where: { teamId }, orderBy: { createdAt: "asc" }, select: TRIGGER_SELECT }),
        prisma.socialAccount.findMany({
            where: { teamId, platform: { in: [...SOCIAL_PLATFORMS] }, status: { not: "DISCONNECTED" } },
            orderBy: { createdAt: "asc" },
            select: { id: true, platform: true, handle: true, status: true },
        }),
        prisma.landingPage.findMany({ where: { teamId, status: "published" }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, slug: true, title: true } }),
        prisma.contentPost.findMany({
            where: { teamId, targets: { some: { status: "PUBLISHED", externalId: { not: null } } } },
            orderBy: { scheduledAt: "desc" },
            take: 30,
            select: { id: true, body: true, targets: { where: { status: "PUBLISHED", externalId: { not: null } }, select: { socialAccountId: true } } },
        }),
    ]);

    const withStats = await Promise.all(
        triggers.map(async (trigger) => {
            const [sent, lastProblem] = await Promise.all([
                prisma.keywordTriggerReply.count({ where: { triggerId: trigger.id, status: "SENT", updatedAt: { gte: since } } }),
                prisma.keywordTriggerReply.findFirst({
                    where: { triggerId: trigger.id, lastError: { not: null }, updatedAt: { gte: since } },
                    orderBy: { updatedAt: "desc" },
                    select: { lastError: true, updatedAt: true },
                }),
            ]);
            return { ...trigger, sentLast7Days: sent, lastError: lastProblem?.lastError ?? null };
        })
    );

    return {
        triggers: withStats,
        accounts,
        landingPages,
        posts: posts.map((post) => ({ id: post.id, body: post.body.slice(0, 120), accountIds: post.targets.map((t) => t.socialAccountId) })),
    };
}
