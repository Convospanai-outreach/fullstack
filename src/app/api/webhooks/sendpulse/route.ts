import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const event = body[0]; // SendPulse usually sends an array

        if (!event) {
            return NextResponse.json({ message: 'No event data' }, { status: 400 });
        }

        // Logic: Store successful interaction templates (e.g. Reply or Open)
        // for "Federated Learning" on the edge.
        // In a real scenario, we might also push this to the Edge Node SQLite directly 
        // or the Edge Node pulls from this DB table.
        // For this refactor, we store in the Sovereign Schema.

        if (event.event_name === 'open') {
            // Track open logic (keep existing or simplified)
             console.log(`[FeedbackLoop] Email Opened: ${event.email?.subject}`);
        }

        if (event.event_name === 'reply') {
            // 1. Extract details from payload
            const { subject, html, text, from } = event.email;
            const senderEmail = from?.email;
            // Assuming we can map senderEmail to a Lead ID via DB lookup
            
            if (senderEmail) {
                const lead = await prisma.lead.findFirst({
                    where: { email: senderEmail }
                });

                if (lead) {
                    // 2. Delegate to Agent
                    const { ReplyAnalyzerAgent } = await import("@/lib/ai/agents/ReplyAnalyzerAgent");
                    await ReplyAnalyzerAgent.analyzeAndTrack(
                         subject || "No Subject",
                         text || html || "",
                         lead.id,
                         senderEmail
                    );
                } else {
                    console.warn(`[Webhook] Reply from unknown lead: ${senderEmail}`);
                }
            } else {
                 console.warn("[Webhook] Reply event missing sender email");
            }
        }

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        console.error('SendPulse Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
