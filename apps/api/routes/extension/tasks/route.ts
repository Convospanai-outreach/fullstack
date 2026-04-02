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

        // Fetch pending jobs for these teams
        // We limit to specific types relevant for extension
        const tasks = await prisma.job.findMany({
            where: {
                teamId: { in: auth.teamIds },
                status: { in: ["pending", "queued"] },
                type: { in: ["VIEW_PROFILE", "LIKE_POST", "CONNECT"] }
            },
            take: 5, // Batch size
            orderBy: { priority: "desc" }
        });

        if (tasks.length > 0) {
            await prisma.job.updateMany({
                where: { id: { in: tasks.map((t) => t.id) } },
                data: {
                    status: "processing",
                    startedAt: new Date()
                }
            });
        }

        // Map to Extension Task format
        const formattedTasks = tasks.map(job => ({
            id: job.id,
            type: job.type,
            payload: job.payload
        }));

        return NextResponse.json({ tasks: formattedTasks });

    } catch (error: any) {
        console.error("Error fetching extension tasks:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
