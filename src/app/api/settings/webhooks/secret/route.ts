import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const body = await req.json();
    const { webhookId } = body;

    if (!webhookId) return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });

    const newSecret = crypto.randomBytes(32).toString("hex");

    try {
        const webhook = await prisma.webhook.update({
            where: { id: webhookId, teamId },
            data: { secret: newSecret }
        });

        return NextResponse.json({ success: true, secret: newSecret });
    } catch (e: any) {
        return NextResponse.json({ error: "Failed to rotate secret" }, { status: 500 });
    }
}
