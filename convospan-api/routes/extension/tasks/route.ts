import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Helper to validate token (simple User ID check for now, ideally JWT)
// The extension sends 'Authorization: <userId>' based on current mock auth in extension
async function validateToken(req: NextRequest) {
    const token = req.headers.get("Authorization");
    if (!token) return null;

    // In real app, verify JWT. Here we assume token is userId for simplicity as per existing extension code
    // Or we verify if it's a valid session token?
    // The previous background.js used 'USER_TOKEN' which was set via message.
    // Let's assume it's the User ID.
    const user = await prisma.user.findUnique({
        where: { id: token },
        include: { memberships: true }
    });
    return user;
}

export async function GET(req: NextRequest) {
    try {
        const user = await validateToken(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's team IDs
        const teamIds = user.memberships.map(m => m.teamId);

        // Fetch pending jobs for these teams
        // We limit to specific types relevant for extension
        const tasks = await prisma.job.findMany({
            where: {
                teamId: { in: teamIds },
                status: "pending",
                type: { in: ["VIEW_PROFILE", "LIKE_POST", "CONNECT"] }
            },
            take: 5, // Batch size
            orderBy: { priority: "desc" }
        });

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
