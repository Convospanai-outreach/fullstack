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

        if (event.event_name === 'open' || event.event_name === 'reply') {
            await prisma.localFeedbackLoop.create({
                data: {
                    originalPrompt: event.email?.subject || "Unknown Prompt",
                    agentOutput: event.email?.html || "Unknown Body",
                    userCorrection: "", // To be filled by human review later
                    sourceTool: "SendPulse",
                    isSynced: false, // Pending sync to Edge Node
                    teamId: "global" // or specific team if available in payload
                }
            });
            console.log(`[FeedbackLoop] Stored successful '${event.event_name}' event for Federated Learning.`);
        }

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        console.error('SendPulse Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
