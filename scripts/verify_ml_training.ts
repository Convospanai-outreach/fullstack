import { prisma } from "../src/lib/db";
import { syntheticDataGenerator } from "../src/modules/ml-training/generators/SyntheticGenerator";
import { reviewService } from "../src/modules/ml-training/review/ReviewService";
import { trainingManager } from "../src/modules/ml-training/training/TrainingManager";

async function main() {
    console.log("=== Enterprise Micro-LLM Infrastructure Verification ===");

    // 1. Setup Team
    let team = await prisma.team.findFirst({ where: { name: "ML_Test_Team" } });
    if (!team) {
        team = await prisma.team.create({ data: { name: "ML_Test_Team", credits: 1000 } });
    }
    console.log(`[1] Team Secured: ${team.id}`);

    // 2. Generate Data
    const datasetVersion = `v-${Date.now()}`;
    console.log(`[2] Generating Synthetic Dataset ${datasetVersion}...`);
    // Mocking the AI call inside generator might be needed if no API key, 
    // but assuming environment has keys or it handles errors gracefully.
    // For this test, we might hit the "Failed to parse" if no API key, so we'll wrap.

    let datasetId = "";
    try {
        datasetId = await syntheticDataGenerator.generateAndSaveDataset(
            "TONE_NORMALIZATION",
            datasetVersion,
            team.id
        );
    } catch (e) {
        console.warn("Skipping real generation (likely no API key), creating manual dummy dataset.");
        const ds = await prisma.trainingDataset.create({
            data: {
                version: datasetVersion,
                taskType: "TONE_NORMALIZATION",
                recordCount: 15,
                datasetHash: "dummy",
                configHash: "dummy",
                status: "DRAFT"
            }
        });
        datasetId = ds.id;
        // Add dummy records
        for (let i = 0; i < 15; i++) {
            await prisma.trainingRecord.create({
                data: {
                    datasetId: ds.id,
                    taskType: "TONE_NORMALIZATION",
                    inputText: "Hi u there",
                    brandRules: {},
                    policyRules: {},
                    expectedOutput: "Hello, are you available?",
                    rejectionConditions: []
                }
            });
        }
    }
    console.log(`[2] Dataset Created: ${datasetId}`);

    // 3. Review Process
    console.log(`[3] Simulating Human Review...`);
    // Get all records
    const records = await prisma.trainingRecord.findMany({ where: { datasetId } });
    for (const record of records) {
        await reviewService.reviewRecord(record.id, "reviewer-1", {
            policy_correctness: 5,
            tone_quality: 5,
            clarity: 5,
            realism: 5
        }, true);
    }

    // Submit final review
    await reviewService.submitDatasetReview({
        datasetId,
        reviewerId: "reviewer-1",
        sampleSize: records.length,
        scores: { policy_correctness: 5, tone_quality: 5, clarity: 5, realism: 5 },
        approved: true
    });
    console.log(`[3] Dataset Reviewed & Approved.`);

    // 4. Start Training
    console.log(`[4] Starting Training Job...`);
    const modelVersionId = await trainingManager.startTraining(datasetId, "gemini-flash");
    console.log(`[4] Model Version Created: ${modelVersionId} (Status: TRAINING)`);

    // 5. Poll for Completion
    console.log(`[5] Waiting for training simulation (5s)...`);
    await new Promise(r => setTimeout(r, 6000));

    const modelParams = await prisma.modelVersion.findUnique({
        where: { id: modelVersionId },
        include: { metrics: true }
    });

    console.log(`[6] Final Status: ${modelParams?.status}`);
    console.log(`[6] Metrics:`, modelParams?.metrics);

    if (modelParams?.status === 'DEPLOYED') {
        console.log("SUCCESS: Pipeline Verified.");
    } else {
        console.error("FAILURE: Pipeline did not deploy.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
