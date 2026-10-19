import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { OUTREACH_MODE_REQUIRED_SINCE, readOutreachMode } from "@/lib/setupSteps";

// A new team answers "my own lead gen or on behalf of a company?" (setup step 1) before
// its first dashboard visit, so login lands it in the wizard until then. Older teams are
// left alone (no answer reads as "company", today's full wizard), and so is anyone below
// MEMBER, who couldn't save the answer (/setup/save requires MEMBER).
async function needsOutreachChoice(): Promise<boolean> {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return false;
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { aiConfig: true, createdAt: true } });
        if (!team || readOutreachMode(team.aiConfig) || team.createdAt < OUTREACH_MODE_REQUIRED_SINCE) return false;
        return await checkTeamPermission(userId, teamId, TeamRole.MEMBER);
    } catch {
        return false; // never block the dashboard on this check
    }
}

export default async function DashboardHomeLayout({ children }: { children: ReactNode }) {
    if (await needsOutreachChoice()) redirect("/setup");
    return <>{children}</>;
}
