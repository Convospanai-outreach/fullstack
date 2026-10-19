import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { readOutreachMode } from "@/lib/setupSteps";

// Every team answers "my own lead gen or on behalf of a company?" (setup step 1) before
// using the dashboard, so login lands it in the wizard until then. Anyone below MEMBER is
// left alone, since they couldn't save the answer (/setup/save requires MEMBER).
async function needsOutreachChoice(): Promise<boolean> {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return false;
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { aiConfig: true } });
        if (!team || readOutreachMode(team.aiConfig)) return false;
        return await checkTeamPermission(userId, teamId, TeamRole.MEMBER);
    } catch {
        return false; // never block the dashboard on this check
    }
}

export default async function DashboardHomeLayout({ children }: { children: ReactNode }) {
    if (await needsOutreachChoice()) redirect("/setup");
    return <>{children}</>;
}
