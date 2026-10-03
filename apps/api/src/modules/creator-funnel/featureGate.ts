import { prisma } from "@/lib/db";

// Same key as apps/web productFlags' "creator-funnel" hidden feature. Unlike most hidden
// features it has no readiness default: it's on only when the team explicitly turned it on
// (Team.enabledFeatures is a JSON string[] once a team customizes its features).
export const CREATOR_FUNNEL_FEATURE = "creator-funnel";

export async function isCreatorFunnelEnabled(teamId: string) {
    const [team, platformSwitch] = await Promise.all([
        prisma.team.findUnique({ where: { id: teamId }, select: { enabledFeatures: true } }),
        // Superadmin platform-wide off switch (apps/web lib/hiddenFeatureSwitches.ts).
        prisma.featureFlag.findUnique({ where: { key: `hidden_feature:${CREATOR_FUNNEL_FEATURE}` }, select: { isEnabled: true } }),
    ]);
    if (platformSwitch?.isEnabled === false) return false;
    const enabled = team?.enabledFeatures;
    return Array.isArray(enabled) && enabled.includes(CREATOR_FUNNEL_FEATURE);
}

// Superadmin platform switch for LinkedIn company pages (lib/flags/config.ts "linkedin_pages",
// default off). Off means page accounts can't be connected, sent for approval or posted to.
export const LINKEDIN_PAGES_SWITCH = "linkedin_pages";

export async function isLinkedInPagesEnabled() {
    const row = await prisma.featureFlag.findUnique({ where: { key: LINKEDIN_PAGES_SWITCH }, select: { isEnabled: true } });
    return row?.isEnabled === true;
}
