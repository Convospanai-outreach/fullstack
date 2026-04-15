import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

function generateTicketId(): string {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    return `SUP-${stamp}-${suffix}`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, subject, message } = body;

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        // Improved Security: Avoid logging PII to console.
        // Persistence: Save to ManualReview table for operator processing instead of discarding.
        await (prisma as any).manualReview.create({
            data: {
                source: "Support Contact",
                payload: { name, email, subject, message },
                reason: "User Support Request",
                severity: "INFO",
                status: "PENDING"
            }
        });

        // Simulate a small processing overhead for UX (reduced to 200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        return NextResponse.json({
            success: true,
            ticketId: generateTicketId(),
            status: "submitted",
            message: "Ticket submitted successfully"
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
