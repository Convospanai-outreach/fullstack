import { aiService } from "../src/lib/aiService";
import { composeNodeA, composeNodeB, composeNodeC } from "../src/modules/email-campaigner/service/emailComposer";
import { prisma } from "../src/lib/db";
import { KnowledgeOrchestrator } from "../src/modules/knowledge/services/knowledgeOrchestrator";

/**
 * Test Autonomous Decision Tree for Email Outreach
 */
async function runDecisionTreeTest() {
    console.log("🚀 Starting Email Decision Tree Simulation...");

    // 0. MOCK AI SERVICE (Simulate successes for testing logic)
    (aiService as any).askAI = async (prompt: string) => {
        if (prompt.includes("Senior Copy Editor")) {
            return JSON.stringify({
                status: "FAIL",
                critique: "The draft was a bit too corporate. Pivoting to a peer-to-peer approach.",
                correction: {
                    subject: "Audit trails for CloudTech?",
                    body: "Hi Alice, saw you downloaded the security whitepaper. Are you struggling with audit trails for cross-cloud clusters or just exploring? Bob"
                }
            });
        }
        if (prompt.includes("Node B follow-ups")) {
            return JSON.stringify({
                subject: "The cost of manual compliance",
                body: "Hi Alice, manual compliance slows down everyone. Worth a chat?",
                reasoning: "Pivot from signal to business cost."
            });
        }
        if (prompt.includes("Node C follow-ups")) {
            return JSON.stringify({
                subject: "Wrong timing?",
                body: "Still relevant or should I pause?",
                reasoning: "Pattern interrupt / Brevity."
            });
        }
        // Default Node A mock
        return JSON.stringify({
            subject: "Security whitepaper signal",
            body: "Hi Alice, saw your download of the security whitepaper. Most companies at your scale struggle with cross-cloud audit trails. Are you open to a chat? Bob",
            internal_notes: "Initial signal-driven outreach."
        });
    };

    // 1. Setup Mock IDs (Ensure these exist or we mock the services)
    const teamId = "test-team-id";
    const campaignId = "test-campaign-id";
    const leadId = "test-lead-id";

    // 1.5. DB SETUP (Phase 9 Compliance)
    console.log("Setting up mock team and contract profile...");
    await prisma.team.upsert({
        where: { id: teamId },
        update: {},
        create: {
            id: teamId,
            name: "Test Team"
        }
    });

    await prisma.contractProfile.upsert({
        where: { teamId },
        update: {},
        create: {
            teamId,
            contractStatus: "ACTIVE",
            allowedCapabilityLayers: ["ALL_FEATURES"],
            allowedChannels: ["EMAIL", "LINKEDIN"],
            aiUsageLimit: 1000000,
            conversationThreadLimit: 1000,
            humanHandoffLimit: 100
        }
    });
    // The "Knowledge Engine" pulls intents from Netjana
    console.log("\n--- [DECISION 1: INITIAL OUTREACH] ---");
    console.log("Context: Lead has visited 'Security Whitepaper' and 'API Docs' on the website (via MCP).");
    
    const nodeAInput = {
        prospect_name: "Alice Smith",
        prospect_title: "Head of Infrastructure",
        prospect_company: "CloudTech",
        pain_context: "Manual security compliance slows down deployments",
        outreach_timing: "Recent intent detected",
        avoid_topics: ["pricing", "competitors"],
        hypothesis: "Alice is struggling with audit trails for cross-cloud clusters.",
        signal_type: "Netjana Activity",
        extracted_signal: "Security Whitepaper Download",
        sender_name: "Bob from CraftMyFunnel",
        sender_email: "bob(at)craftmyfunnel.ai"
    };

    try {
        console.log("Generating Node A (Signal-Driven)...");
        const nodeA = await composeNodeA(nodeAInput, teamId); 
        console.log("✅ Node A Generated:");
        console.log(`   Subject: ${nodeA.subject}`);
        console.log(`   Body Chunk: ${nodeA.body.substring(0, 100)}...`);
        console.log(`   Internal Notes: ${nodeA.internal_notes}`);

        // 3. Scenario 2: Behavioral Branching (Node B)
        // Prospect OPENED the email but did not respond.
        console.log("\n--- [DECISION 2: OPENED BUT NO REPLY (3 DAYS LATER)] ---");
        console.log("AI Strategy: Pivot from 'Signal' to 'Business Consequence'.");
        
        const nodeB = await composeNodeB({
            ...nodeAInput,
            original_subject: nodeA.subject,
            original_body: nodeA.body,
            days_since_send: 3
        }, teamId);

        console.log("✅ Node B Generated:");
        console.log(`   Subject: ${nodeB.subject}`);
        console.log(`   Body Chunk: ${nodeB.body.substring(0, 100)}...`);
        console.log(`   Reasoning: ${nodeB.reasoning}`);

        // 4. Scenario 3: Behavioral Branching (Node C)
        // Prospect NEVER OPENED the original email.
        console.log("\n--- [DECISION 3: NOT OPENED (5 DAYS LATER)] ---");
        console.log("AI Strategy: Pattern-Interrupt. Ultra-short. One-sentence body.");
        
        const nodeC = await composeNodeC({
            ...nodeAInput,
            original_subject: nodeA.subject,
            original_body: nodeA.body,
        }, teamId);

        console.log("✅ Node C Generated:");
        console.log(`   Subject: ${nodeC.subject}`);
        console.log(`   Body: ${nodeC.body}`);
        console.log(`   Reasoning: ${nodeC.reasoning}`);

        // 5. Final Explanation of Decision Tree
        console.log("\n--- [SYSTEM ARCHITECTURE: DECISION TREE LOGIC] ---");
        console.log("1. RAG PHASE: KnowledgeOrchestrator pulls real-time signals via MCP.");
        console.log("2. ENRICHMENT: LLM processes the 'Mirror' (Signal) and 'Hypothesis' (Diagnosis).");
        console.log("3. BRANCHING: Sequence Service detects events (OPEN/REPLY):");
        console.log("   - EVENT(OPEN_NO_REPLY) -> Trigger Node B (Pivot to business cost).");
        console.log("   - EVENT(NO_OPEN) -> Trigger Node C (Pivot to brevity).");
        console.log("4. SOVEREIGNTY: Sovereign Firewall ensures PII hashing throughout the tree.");

    } catch (err) {
        console.error("❌ Test Failed:", err);
    }
}

runDecisionTreeTest().then(() => process.exit(0));
