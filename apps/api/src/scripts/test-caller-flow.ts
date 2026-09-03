
import { CallerService } from "../modules/caller/CallerService";
import { ConversationService } from "../modules/conversation/ConversationService";
import { prisma } from "../lib/db";
import { ConversationState } from "@prisma/client";

async function testCallerFlow() {
    console.log("Starting Caller System Verification...");

    // Setup: Get a team and a lead
    let team = await prisma.team.findFirst({ where: { name: "Caller Flow Test Org" } });
    if (!team) {
        team = await prisma.team.create({ data: { name: "Caller Flow Test Org" } });
    }
    const teamId = team.id;

    let lead = await prisma.lead.findFirst({ where: { email: "test.lead@example.com" } });
    if (!lead) {
        console.log("Re-creating dummy lead...");
        lead = await prisma.lead.create({
            data: { email: "test.lead@example.com", pipelineState: "COLD", teamId }
        });
    }

    // Ensure Queue Entry
    await CallerService.ensureQueueEntry(lead.id);
    console.log("Queue entry ensured.");

    // Simulate Conversation State -> HANDOFF_REQUIRED
    // Need a thread first
    const thread = await ConversationService.startThread(lead.id);
    await ConversationService.addEntry(thread.id, lead.id, "system", "AI failed, handing off.");
    // Must go through valid transitions: INITIATED -> ENGAGED -> QUALIFIED -> HANDOFF_REQUIRED
    await ConversationService.transitionState(thread.id, ConversationState.ENGAGED);
    await ConversationService.transitionState(thread.id, ConversationState.QUALIFIED);
    await ConversationService.transitionState(thread.id, ConversationState.HANDOFF_REQUIRED);
    console.log("Lead moved to HANDOFF_REQUIRED.");

    // Create Dummy User
    const userId = "test-caller-id";
    await prisma.user.upsert({
        where: { email: "caller@test.com" },
        update: {},
        create: {
            id: userId,
            email: "caller@test.com",
            enterpriseRole: "CALLER"
        }
    });

    // Test Queue Fetching (Mock User ID)
    const queue = await CallerService.getQueue(userId, teamId);
    console.log(`Queue fetched. Pool size: ${queue.pool.length}, Assigned: ${queue.assigned.length}`);

    // Test Claim
    await CallerService.claimLead(lead.id, userId, teamId);
    console.log("Lead claimed.");

    // Verify State Transition
    const updatedThread = await prisma.conversationThread.findUnique({ where: { id: thread.id } });
    if (updatedThread?.state === ConversationState.COORDINATING) {
        console.log("PASS: Auto-transition to COORDINATING successful.");
    } else {
        console.error(`FAIL: Top state is ${updatedThread?.state}, expected COORDINATING`);
    }

    // Test Completion
    await CallerService.completeTask(lead.id, userId, teamId, ConversationState.MEETING_CONFIRMED, "Booked it!");
    console.log("Task completed (MEETING_CONFIRMED).");

    const finalQueue = await prisma.meetingCoordinationQueue.findUnique({ where: { leadId: lead.id } });
    if (finalQueue?.status === "COMPLETED") {
        console.log("PASS: Queue item marked COMPLETED.");
    } else {
        console.error(`FAIL: Queue status is ${finalQueue?.status}`);
    }
}

testCallerFlow().catch(console.error);
