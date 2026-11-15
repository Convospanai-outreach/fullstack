import { prisma } from "@/lib/db";

// Where a CRM lead came from on Instagram: the keyword auto-reply that created it or was merged
// into it (KeywordTriggerReply.leadId). Read at request time, so nothing is stored on the lead.
// The keyword is the trigger's first keyword: the reply does not store which word matched.

export type InstagramLeadSource = {
    triggerId: string;
    keyword: string | null;
    contentPostId: string | null;
    postTitle: string | null;
    platform: string;
};

const TITLE_LENGTH = 60;

export async function getInstagramSourceForLead(teamId: string, leadId: string): Promise<InstagramLeadSource | null> {
    const reply = await prisma.keywordTriggerReply.findFirst({
        where: { teamId, leadId },
        orderBy: { createdAt: "asc" },
        select: {
            trigger: {
                select: {
                    id: true,
                    keywords: true,
                    contentPostId: true,
                    socialAccount: { select: { platform: true } },
                },
            },
        },
    });
    const trigger = reply?.trigger;
    if (!trigger) return null;

    const post = trigger.contentPostId
        ? await prisma.contentPost.findFirst({ where: { id: trigger.contentPostId, teamId }, select: { body: true } })
        : null;

    return {
        triggerId: trigger.id,
        keyword: trigger.keywords[0] ?? null,
        contentPostId: trigger.contentPostId,
        postTitle: post ? post.body.trim().slice(0, TITLE_LENGTH) : null,
        platform: trigger.socialAccount.platform,
    };
}
