import { prisma } from "@/lib/db";
import { checkSubscription } from "@/lib/subscription";

// The copilot's store edition: the bots the extension may switch on. Replier, Pruner, chat export
// and the profile-visiting contact fetcher are not part of it.
export const COPILOT_FEATURES = { auto_comment: true, lead_hunter: true, outreach: true, contacts_fetcher: true } as const;

export const NO_PLAN = { code: "NO_PLAN", error: "No active plan. Upgrade your CraftMyFunnel plan to use the extension." };
export const NO_CREDITS = { code: "NO_CREDITS", error: "No credits left. Top up your CraftMyFunnel credits to keep drafting." };

/** What the extension shows and gates on: plan state, the team's credits, enabled bots. */
export async function copilotAccount(userId: string, teamId: string) {
    const [active, subscription, team] = await Promise.all([
        checkSubscription(userId),
        prisma.subscription.findUnique({
            where: { userId },
            select: { currentPeriodEnd: true, plan: { select: { name: true } } }
        }),
        prisma.team.findUnique({ where: { id: teamId }, select: { credits: true } })
    ]);
    return {
        valid: active,
        plan: {
            active,
            plan: subscription?.plan?.name || "none",
            expires_at: subscription?.currentPeriodEnd?.toISOString() || null
        },
        credits: team?.credits ?? 0,
        features: active ? { ...COPILOT_FEATURES } : {}
    };
}
