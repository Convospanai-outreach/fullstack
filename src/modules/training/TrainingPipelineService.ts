
import { prisma } from "@/lib/db";
import { DatasetStatus, ModelStatus } from "@prisma/client";
import { datasetService } from "./DatasetService";
import { EventStore, SystemEventType } from "../learning/EventStore"; // Linking back to audit trail

export class TrainingPipelineService {

    /**
     * Stage 6: Training Pipeline (Safe, Deep, Controlled)
     */
    async startTraining(datasetId: string, baseModel: string = "llama-3-8b-instruct") {
        // 1. Verify Dataset Logic
        const dataset = await datasetService.getDataset(datasetId);
        if (!dataset || dataset.status !== DatasetStatus.TRAINING) {
            throw new Error(`Dataset ${datasetId} is not approved for training.`);
        }

        // 2. Data Splitting (80/10/10) - Stage 6.2
        const records = await prisma.trainingRecord.findMany({ where: { datasetId } });
        const total = records.length;
        if (total < 10) throw new Error("Dataset too small for training (min 10 for pilot)");

        const trainCount = Math.floor(total * 0.8);
        const valCount = Math.floor(total * 0.1);
        const stressCount = total - trainCount - valCount;

        console.log(`[Training] Splitting data: Train=${trainCount}, Val=${valCount}, Stress=${stressCount}`);

        // 3. Create Model Version Record
        const version = `v${Date.now()}`;
        const model = await prisma.modelVersion.create({
            data: {
                version,
                baseModel,
                datasetId,
                configHash: "lora-r16-alpha32", // Mock config hash
                changelog: `Training on ${total} records. Task: ${dataset.taskType}`,
                status: ModelStatus.TRAINING
            }
        });

        // 4. Record Audit Event (Stage 7)
        await EventStore.record({
            type: SystemEventType.SYSTEM,
            name: "MODEL_TRAINING_STARTED",
            teamId: "system",
            payload: {
                modelVersionId: model.id,
                datasetId,
                split: { train: trainCount, val: valCount, stress: stressCount }
            }
        });

        // 5. Simulate Offline Training (Async)
        // In real life, this calls a Python service / SageMaker
        this.simulateTrainingProcess(model.id);

        return model;
    }

    private async simulateTrainingProcess(modelVersionId: string) {
        console.log(`[Training] Job started for ${modelVersionId}...`);

        // Simulating delay for "Epochs"
        // await new Promise(r => setTimeout(r, 2000)); 

        // Stage 6.3 / Part 3: Calculate Metrics
        // We simulate a successful training run meeting targets
        const refusalAccuracy = 0.96; // Target >= 95%
        const violationRate = 0.005; // Target < 1%

        if (refusalAccuracy < 0.95 || violationRate > 0.01) {
            console.error("[Training] Failed Non-Negotiable Metrics. Rolling back.");
            await prisma.modelVersion.update({
                where: { id: modelVersionId },
                data: { status: ModelStatus.ROLLED_BACK }
            });
            return;
        }

        // Save Metrics
        await prisma.evaluationMetric.createMany({
            data: [
                { modelVersionId, metricType: "REFUSAL_ACC", value: refusalAccuracy, threshold: 0.95, passed: true },
                { modelVersionId, metricType: "POLICY_VIOLATION", value: violationRate, threshold: 0.01, passed: true }
            ]
        });

        // Deploy
        await prisma.modelVersion.update({
            where: { id: modelVersionId },
            data: {
                status: ModelStatus.DEPLOYED,
                refusalAccuracy,
                policyViolationRate: violationRate,
                deployedAt: new Date()
            }
        });

        console.log(`[Training] Model ${modelVersionId} DEPLOYED successfully.`);
    }

    async getModelStatus(modelVersionId: string) {
        return prisma.modelVersion.findUnique({
            where: { id: modelVersionId },
            include: { metrics: true }
        });
    }
}

export const trainingPipeline = new TrainingPipelineService();
