import { prisma } from "@/lib/db";

// Same key as apps/web productFlags' "creator-funnel" hidden feature. Unlike most hidden
// features it has no readiness default: it's on only when the team explicitly turned it on
// (Team.enabledFeatures is a JSON string[] once a team customizes its features).
export const CREATOR_FUNNEL_FEATURE = "creator-funnel";

export async function isCreatorFunnelEnabled(teamId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { enabledFeatures: true } });
    const enabled = team?.enabledFeatures;
    return Array.isArray(enabled) && enabled.includes(CREATOR_FUNNEL_FEATURE);
}
