import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { CallerService } from "@/modules/caller/CallerService";
import { UserRole } from "@prisma/client";

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
        const { action, leadId, outcome, notes } = body;

        if (!leadId) {
            return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
        }

        if (action === "claim") {
            const result = await CallerService.claimLead(leadId, token.sub);
            return NextResponse.json({ result });
        }

        if (action === "complete") {
            if (!outcome) return NextResponse.json({ error: "Outcome required" }, { status: 400 });
            await CallerService.completeTask(leadId, token.sub, outcome, notes);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Caller action error:", error);
        return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
    }
}
