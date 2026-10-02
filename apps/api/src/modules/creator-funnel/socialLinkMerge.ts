import { prisma } from "@/lib/db";
import { verifyLinkToken } from "./linkToken";

// A landing page sign-up that came through a keyword auto-reply link (?t=, linkToken.ts) is
// merged into the lead that auto-reply went to: the DM/comment person and the sign-up become
// one lead. Only when it's safe:
// - the token is genuine and wasn't expired when the person signed up;
// - the auto-reply and its lead belong to the page's team;
// - it never overwrites a different email already on the lead, and never gives the lead an
//   email another lead in the team already has (no duplicates).
// Otherwise it returns null and the intake creates or updates a lead by email as before.

type SignUp = {
    teamId: string;
    socialToken: string | null;
    createdAt: Date;
    email: string | null;
    name: string | null;
    phone: string | null;
    company: string | null;
    title: string | null;
};

const clean = (value: string | null | undefined) => value?.trim() || undefined;

export async function mergeSignupIntoSocialLead(signUp: SignUp, campaignId?: string): Promise<string | null> {
    if (!signUp.socialToken) return null;
    const replyId = verifyLinkToken(signUp.socialToken, signUp.createdAt);
    if (!replyId) return null;

    const { teamId } = signUp;
    const reply = await prisma.keywordTriggerReply.findFirst({ where: { id: replyId, teamId }, select: { leadId: true } });
    if (!reply?.leadId) return null;
    const lead = await prisma.lead.findFirst({
        where: { id: reply.leadId, teamId },
        select: { id: true, email: true, phone: true, fullName: true, company: true, jobTitle: true, campaignId: true },
    });
    if (!lead) return null;

    const email = clean(signUp.email)?.toLowerCase();
    if (email && lead.email && lead.email.toLowerCase() !== email) return null;
    const addingEmail = Boolean(email && !lead.email);
    if (addingEmail) {
        const other = await prisma.lead.findFirst({ where: { teamId, email: { equals: email, mode: "insensitive" }, id: { not: lead.id } }, select: { id: true } });
        if (other) return null;
    }

    // Social leads are named after their @handle (or not at all) until they tell us their name.
    const name = clean(signUp.name);
    const named = Boolean(lead.fullName && !lead.fullName.startsWith("@"));
    const updated = await prisma.lead.updateMany({
        // Conditional on the email we read, so a concurrent change can't be overwritten.
        where: { id: lead.id, teamId, email: lead.email },
        data: {
            ...(addingEmail ? { email } : {}),
            ...(name && !named ? { fullName: name } : {}),
            phone: lead.phone || clean(signUp.phone),
            company: lead.company || clean(signUp.company),
            jobTitle: lead.jobTitle || clean(signUp.title),
            campaignId: lead.campaignId || campaignId,
        },
    });
    return updated.count === 1 ? lead.id : null;
}
