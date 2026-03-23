
import { ConversationService } from "../modules/conversation/ConversationService";
import { prisma } from "../lib/db";
import { ConversationState } from "@prisma/client";

async function testConversationFlow() {
    console.log("Starting Conversation State Machine Test...");

    let lead = await prisma.lead.findFirst();
    if (!lead) {
        console.log("No lead found. Creating dummy lead...");
        lead = await prisma.lead.create({
            data: {
                email: "test.lead@example.com",
                status: "NEW",
                pipelineState: "COLD"
            }
        });
    }
    console.log(`Using Lead: ${lead.id}`);

    // 1. Start Thread
    const thread = await ConversationService.startThread(lead.id, "EMAIL");
    console.log(`Thread Started: ${thread.id} [${thread.state}]`);

    // 2. Add Entry
    await ConversationService.addEntry(thread.id, lead.id, "system", "Initial outreach");
    console.log("Entry added.");

    // 3. Valid Transition: INITIATED -> ENGAGED
    await ConversationService.transitionState(thread.id, ConversationState.ENGAGED);
    console.log("State transitioned to ENGAGED.");

    // 4. Invalid Transition: ENGAGED -> MEETING_CONFIRMED (Skip steps)
    try {
        await ConversationService.transitionState(thread.id, ConversationState.MEETING_CONFIRMED);
        console.error("FAIL: Invalid transition should have thrown error.");
    } catch (e) {
        console.log("PASS: Invalid transition blocked correctly.");
    }

    // 5. Valid Transition: ENGAGED -> QUALIFIED
    await ConversationService.transitionState(thread.id, ConversationState.QUALIFIED);
    console.log("State transitioned to QUALIFIED.");

    console.log("Test Complete.");

    // Cleanup optional? No, keep data for now.
}

testConversationFlow().catch(console.error);
