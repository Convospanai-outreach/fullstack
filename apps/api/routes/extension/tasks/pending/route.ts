import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";
import { resolveExtensionTeamScope } from "../../_lib/teamScope";

const SUPPORTED_TASK_TYPES = [
    "OPEN_PROFILE",
    "ADD_LEAD",
    "INSERT_DRAFT",
    "LOG_MANUAL_LINKEDIN_ACTION"
];

function taskType(job: { type: string; taskType: string | null }) {
    return job.taskType || job.type;
}

export async function GET(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }

        const teamScope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
        if (!teamScope.ok) {
            return NextResponse.json({ ok: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }

        const candidates = await prisma.job.findMany({
            where: {
                teamId: teamScope.teamId,
                status: { in: ["pending", "queued"] },
                OR: [
                    { type: { in: SUPPORTED_TASK_TYPES } },
                    { taskType: { in: SUPPORTED_TASK_TYPES } }
                ]
            },
            take: 5,
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" }
            ],
            select: {
                id: true,
                type: true,
                taskType: true,
                payload: true
            }
        });

        const claimedTasks: Array<{ id: string; type: string; payload: unknown }> = [];
        const now = new Date();

        for (const candidate of candidates) {
            const claim = await prisma.job.updateMany({
                where: {
                    id: candidate.id,
                    teamId: teamScope.teamId,
                    status: { in: ["pending", "queued"] }
                },
                data: {
                    status: "processing",
                    startedAt: now
                }
            });

            if (claim.count === 1) {
                claimedTasks.push({
                    id: candidate.id,
                    type: taskType(candidate),
                    payload: candidate.payload
                });
            }
        }

        return NextResponse.json({ ok: true, tasks: claimedTasks });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
