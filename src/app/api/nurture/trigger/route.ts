
import { NextResponse } from "next/server";
import { NurtureService } from "@/modules/learning/NurtureService";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "generate";
        const teamId = session.user?.image || "team-convo-1"; // Use image as teamId proxy for demo

        if (action === "sync") {
            const data = await NurtureService.syncEvents();
            return NextResponse.json({ ok: true, events: data.calendarEvents.length });
        }

        const result = await NurtureService.generateNurtureTasks(teamId);
        return NextResponse.json({ ok: true, tasksGenerated: result.tasksCreated });

    } catch (error: any) {
        console.error("[NurtureAPI] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    // Return upcoming events for the radar widget
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const horizon = new Date();
        horizon.setDate(horizon.getDate() + 30); // 30 day window for the UI

        const prisma = (await import("@/lib/db")).prisma;
        const upcoming = await prisma.calendarEvent.findMany({
            where: {
                eventDate: {
                    gte: new Date(),
                    lte: horizon
                }
            },
            orderBy: { eventDate: 'asc' },
            take: 5
        });

        return NextResponse.json({ ok: true, events: upcoming });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
