import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../_lib/auth";

export async function GET(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        if (auth.teamIds.length === 0) {
            return NextResponse.json({ tasks: [] });
        }

        const claimedAt = new Date();

        // Fetch a small candidate set, then atomically claim jobs one-by-one.
        // This avoids returning tasks that another poller already grabbed.
        const candidates = await prisma.job.findMany({
            where: {
                teamId: { in: auth.teamIds },
                status: { in: ["pending", "queued"] },
                type: { in: ["VIEW_PROFILE", "LIKE_POST", "CONNECT"] }
            },
            take: 5, // Batch size
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" }
            ]
        });

        const claimedTasks: Array<{ id: string; type: string; payload: unknown }> = [];

        for (const candidate of candidates) {
            const claim = await prisma.job.updateMany({
                where: {
                    id: candidate.id,
                    teamId: { in: auth.teamIds },
                    status: { in: ["pending", "queued"] }
                },
                data: {
                    status: "processing",
                    startedAt: claimedAt
                }
            });

            if (claim.count === 1) {
                claimedTasks.push({
                    id: candidate.id,
                    type: candidate.type,
                    payload: candidate.payload
                });
            }
        }

        return NextResponse.json({ tasks: claimedTasks });

    } catch (error: any) {
        console.error("Error fetching extension tasks:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
