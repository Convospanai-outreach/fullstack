
import { dataIngestionService } from "../src/modules/learning/DataIngestionService";
import { modelGateway } from "../src/ai/ModelGateway";
import { prisma } from "../src/lib/db";
import { EventStore, SystemEventType } from "../src/modules/learning/EventStore";
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Mock the generate method
// Since modelGateway is an instance, we can overwrite the method reference
modelGateway.generate = async () => {
    console.log("[MockGateway] Generating deterministic response...");
    return "This is a deterministic AI draft for testing purposes.";
};

async function main() {
    console.log("Starting Offline Ingestion Test...");
    const TEAM_ID = "test-team-offline-ingestion";
    const TEST_FILE_PATH = path.resolve(__dirname, "test-leads-offline.xlsx");

    try {
        // Cleanup
        await prisma.systemEvent.deleteMany({ where: { teamId: TEAM_ID } });
        await prisma.generation.deleteMany({ where: { lead: { teamId: TEAM_ID } } });
        await prisma.lead.deleteMany({ where: { teamId: TEAM_ID } });
        await prisma.campaign.deleteMany({ where: { teamId: TEAM_ID } });
        await prisma.team.deleteMany({ where: { id: TEAM_ID } });

        // Setup Team & Campaign
        await prisma.team.create({ data: { id: TEAM_ID, name: "Offline Test Team" } });
        await prisma.campaign.create({
            data: { id: "offline-camp-1", name: "Offline Campaign", teamId: TEAM_ID, status: 'active' }
        });

        // Create Excel
        const wb = XLSX.utils.book_new();
        const data = [{ Name: "Offline Tester", Email: "test@offline.com", Company: "Offline Inc", Industry: "SaaS" }];
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, TEST_FILE_PATH);

        // Run Ingestion
        console.log("Processing file upload...");
        const results = await dataIngestionService.processFileUpload(TEAM_ID, TEST_FILE_PATH, "offline-camp-1");
        console.log("Results:", results);

        if (results.some(r => r.status === 'FAILED')) throw new Error("Ingestion rows failed");

        // Verify Events (Ingestion & Generation)
        const events = await prisma.systemEvent.findMany({ where: { teamId: TEAM_ID } });
        const leadIngested = events.find(e => e.name === "LEAD_INGESTED");
        const draftGenerated = events.find(e => e.name === "DRAFT_GENERATED");

        if (!leadIngested) throw new Error("Missing LEAD_INGESTED event");
        if (!draftGenerated) throw new Error("Missing DRAFT_GENERATED event");

        const generation = await prisma.generation.findFirst({ where: { lead: { teamId: TEAM_ID } } });
        if (!generation) throw new Error("Generation record not found");
        if (generation.generatedText !== "This is a deterministic AI draft for testing purposes.") {
            throw new Error("Generation text mismatch - Mock did not work?");
        }

        // Test Feedback
        console.log("Testing Feedback...");
        await dataIngestionService.recordFeedback(generation.id, "THUMBS_UP");

        const feedbackEvent = await prisma.systemEvent.findFirst({
            where: { teamId: TEAM_ID, name: "FEEDBACK_RECEIVED" }
        });
        if (!feedbackEvent) throw new Error("Missing FEEDBACK_RECEIVED event");

        console.log("✅ Offline Ingestion Test PASSED.");

    } catch (e) {
        console.error("❌ Test FAILED:", e);
        process.exit(1);
    } finally {
        if (fs.existsSync(TEST_FILE_PATH)) fs.unlinkSync(TEST_FILE_PATH);
        await prisma.$disconnect();
    }
}

main();
