import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { JobQueue } from "@/lib/queue";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return new NextResponse("Unauthorized", { status: 401 });
    const { teamId, id: userId } = session.user as any;

    try {
        const { leadId, content, platform } = await req.json();

        if (!leadId || !content) {
            return new NextResponse("Missing fields", { status: 400 });
        }

        // GUARDRAIL CHECK
        const { guardrailService } = await import("@/modules/governance/service/guardrailService");
        const validation = await guardrailService.evaluate(teamId, content);

        if (!validation.isSafe) {
            const reason = validation.violations[0]?.reason || "Content blocked by guardrails";
            console.warn(`[Guardrail] Blocked message: ${reason}`);
            return NextResponse.json({ error: reason, action: "block" }, { status: 403 });
        }

        // 1. Save Message to DB
        const message = await prisma.message.create({
            data: {
                leadId,
                content,
                direction: "OUTBOUND",
                platform: platform || "LINKEDIN",
                sender: session.user.name || "Me",
                isRead: true
            }
        });

        // 2. Queue Job to actually send it via Browser/Email
        if (platform === "LINKEDIN") {
            // Retrieve Lead to get URL
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });

            if (lead?.linkedIn) {
                await JobQueue.enqueue("LINKEDIN_ACTION", {
                    action: "SEND_MESSAGE", // We need to implement this in handler
                    profileUrl: lead.linkedIn,
                    message: content,
                    userId
                }, { teamId });
            }
        }

        return NextResponse.json(message);
    } catch (error) {
        console.error("Reply Error:", error);
        return new NextResponse("Failed to send reply", { status: 500 });
    }
}
