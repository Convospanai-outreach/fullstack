
import { syntheticDataService } from "../src/modules/training/SyntheticDataService";
import { datasetService } from "../src/modules/training/DatasetService";
import { trainingPipeline } from "../src/modules/training/TrainingPipelineService";
import { prisma } from "../src/lib/db";
import { TrainingTaskType, DatasetStatus, ModelStatus } from "@prisma/client";
import { modelGateway } from "@/ai/ModelGateway";

// Mock Gateway for Synthetic Data Generation
modelGateway.generate = async (req: any) => {
    // Return mock JSON array of records
    const records = Array(5).fill(0).map((_, i) => ({
        input_text: `Test Input ${i}`,
        expected_output: `Test Output ${i}`,
        task_type: "TONE_NORMALIZATION",
        brand_rules: { tone: "professional" },
        policy_rules: { no_pressure: true },
        rejection_conditions: []
    }));
    return JSON.stringify(records);
};

async function main() {
    console.log("Starting ML Training Pipeline Verification...");
    const reviewerId = "test-reviewer-id";

    // Cleanup
    await prisma.modelVersion.deleteMany({});
    await prisma.evaluationMetric.deleteMany({});
    await prisma.datasetReview.deleteMany({});
    await prisma.trainingRecord.deleteMany({});
    await prisma.trainingDataset.deleteMany({});
    await prisma.user.deleteMany({ where: { id: reviewerId } });

    // Create Reviewer User
    await prisma.user.create({
        data: {
            id: reviewerId,
            email: "reviewer@test.com",
            name: "Test Reviewer",
            email: "reviewer@test.com",
            name: "Test Reviewer",
            password: "hashed_password"
        }
    });

    // Create System Team (Required for Audit Logging)
    await prisma.team.upsert({
        where: { id: "system" },
        update: {},
        create: { id: "system", name: "System Team" }
    });

    // 1. Create Dataset
    console.log("1. Creating Dataset...");
    const dataset = await datasetService.createDataset("TONE_NORMALIZATION", "v1.0-alpha");
    console.log(`   Dataset created: ${dataset.id}`);

    // 2. Generate Synthetic Data
    console.log("2. Generating Synthetic Data...");
    // We generate 15 records to meet the min 10 limit for training + stress set
    await syntheticDataService.generateBatch(dataset.id, "TONE_NORMALIZATION", 15);
    await syntheticDataService.generateBatch(dataset.id, "TONE_NORMALIZATION", 5); // Add more

    // 3. Human Review (Pass)
    console.log("3. Conducting Human Review...");
    const review = await datasetService.reviewDataset(dataset.id, reviewerId, 5, {
        policy: 5, tone: 5, clarity: 4, realism: 5
    });

    if (!review.approved) throw new Error("Dataset review failed unexpectedly.");
    console.log(`   Review Approved: Score ${review.avgScore}`);

    // 4. Approve for Training
    await datasetService.approveDataset(dataset.id);
    console.log("   Dataset status transitioned to TRAINING.");

    // 5. Start Training Pipeline
    console.log("4. Starting Training Pipeline...");
    const model = await trainingPipeline.startTraining(dataset.id);

    console.log(`   Model Version Created: ${model.version} (Status: ${model.status})`);

    // Verify Audit Log
    const auditEvent = await prisma.systemEvent.findFirst({
        where: { name: "MODEL_TRAINING_STARTED" }
    });
    if (!auditEvent) throw new Error("Audit event MODEL_TRAINING_STARTED missing.");
    console.log("   Audit Event Verified.");

    // Wait for Simulation (Short sleep to allow async process if needed, though simulateTrainingProcess is awaited in my impl for now by default if synchronous - wait, startTraining creates simulated process async but let's check. 
    // In my code: this.simulateTrainingProcess(model.id) is NOT awaited in startTraining.
    // So we need to poll or wait.

    console.log("   Waiting for Training Simulation...");
    await new Promise(r => setTimeout(r, 100)); // Small tick

    // 6. Verify Deployment
    const finalModel = await trainingPipeline.getModelStatus(model.id);

    console.log(`   Final Status: ${finalModel?.status}`);

    if (finalModel?.status !== "DEPLOYED") {
        // If simulation failed or logic changed
        throw new Error(`Model not DEPLOYED. Status: ${finalModel?.status}`);
    }

    if (finalModel.refusalAccuracy && finalModel.refusalAccuracy < 0.95) {
        throw new Error("Refusal Accuracy metric failed target.");
    }

    console.log("✅ ML Training Pipeline Verified!");
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
