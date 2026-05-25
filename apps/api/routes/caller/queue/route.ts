import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { CallerService } from "@/modules/caller/CallerService";
import { UserRole, ConversationState } from "@prisma/client";
import { z } from "zod";

// Shared function to check caller or admin role (Enterprise RBAC)
function isAllowed(role?: string) {
    if (!role) return false;
    return (
        role === UserRole.CALLER ||
        role === UserRole.SALES_MANAGER ||
        role === UserRole.ORG_ADMIN ||
        role === UserRole.SYSTEM_ADMIN
    );
}

// Valid ConversationState values for outcome validation
const VALID_OUTCOMES = Object.values(ConversationState) as [string, ...string[]];

const CompleteActionSchema = z.object({
    action: z.literal("complete"),
    leadId: z.string().min(1),
    outcome: z.enum(VALID_OUTCOMES),
    notes: z.string().optional(),
});

const ClaimActionSchema = z.object({
    action: z.literal("claim"),
    leadId: z.string().min(1),
});

const CallerActionSchema = z.discriminatedUnion("action", [
    ClaimActionSchema,
    CompleteActionSchema,
]);

export async function GET(req: NextRequest) {
    const token = await getToken({ req });
    if (!token || !token.sub || !isAllowed(token.enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const queue = await CallerService.getQueue(token.sub);
        return NextResponse.json(queue);
    } catch (error) {
        console.error("Queue fetch error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const token = await getToken({ req });
    if (!token || !token.sub || !isAllowed(token.enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const validation = CallerActionSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                error: "Invalid request",
                details: validation.error.format()
            }, { status: 400 });
        }

        const data = validation.data;

        if (data.action === "claim") {
            const result = await CallerService.claimLead(data.leadId, token.sub);
            return NextResponse.json({ result });
        }

        if (data.action === "complete") {
            await CallerService.completeTask(data.leadId, token.sub, data.outcome as ConversationState, data.notes);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Caller action error:", error);
        return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
    }
}
