/**
 * Training Manager Service - Enterprise ML Training
 * 
 * Orchestrates the fine-tuning lifecycle:
 * 1. Validates Dataset (Must be REVIEWED)
 * 2. Prepares Training Job (JSONL export, etc.)
 * 3. Triggers Fine-Tuning (Mock/Real Adapter)
 * 4. Polling & Status Updates
 * 5. Triggers Post-Training Evaluation
 */

import { prisma } from "@/lib/db";
import { evaluationService } from "../evaluation/EvaluationService";

export class TrainingManager {

    /**
     * Start a fine-tuning job for a specific dataset
     */
    async startTraining(datasetId: string, baseModel: string = "gemini-1.5-flash"): Promise<string> {

        // 1. Validate Dataset
        const dataset = await prisma.trainingDataset.findUnique({
            where: { id: datasetId },
            include: { records: true } // Need records for "export"
        });

        if (!dataset) {
            throw new Error("Dataset not found");
        }

        if (dataset.status !== 'REVIEWED') {
            throw new Error(`Dataset must be in REVIEWED status. Current: ${dataset.status}`);
        }

        if (dataset.records.length < 10) {
            throw new Error("Dataset too small for training (min 10 records)");
        }

        console.log(`[TrainingManager] Starting training for Dataset ${dataset.version} with base model ${baseModel}`);

        // 2. Create Model Version Entry
        const version = `${dataset.version}-v${Date.now()}`;

        const modelVersion = await prisma.modelVersion.create({
            data: {
                version: version,
                baseModel: baseModel,
                datasetId: datasetId,
                configHash: `cfg-${Date.now()}`, // Placeholder for hyperparams
                changelog: `Automated training run based on dataset ${dataset.version}`,
                status: 'TRAINING'
            }
        });

        // 3. Trigger Async Training Job (Mock for V1)
        // In a real system, this would call OpenAI/Gemini Fine-tuning API
        // and return a job ID.
        this.simulateTrainingProcess(modelVersion.id, dataset.records);

        return modelVersion.id;
    }

    /**
     * Simulator for the training backend
     * Transitions: TRAINING -> VALIDATION -> DEPLOYED (or FAILED)
     */
    private async simulateTrainingProcess(modelVersionId: string, records: any[]) {
        // Simulate training time (e.g., 5 seconds for demo, usually hours)
        setTimeout(async () => {
            try {
                console.log(`[TrainingManager] Training complete for ${modelVersionId}. Moving to VALIDATION.`);

                // Update status to VALIDATION
                await prisma.modelVersion.update({
                    where: { id: modelVersionId },
                    data: { status: 'VALIDATION' }
                });

                // Trigger Evaluation
                await this.runPostTrainingEvaluation(modelVersionId, records);

            } catch (error) {
                console.error(`[TrainingManager] Training Job Failed:`, error);
                await prisma.modelVersion.update({
                    where: { id: modelVersionId },
                    data: {
                        status: 'ROLLED_BACK', // Or error status if we had one
                        changelog: `Training Failed: ${error}`
                    }
                });
            }
        }, 5000);
    }

    /**
     * Run automated benchmarks before deployment
     */
    private async runPostTrainingEvaluation(modelVersionId: string, trainingRecords: any[]) {
        console.log(`[TrainingManager] Running Evaluation for ${modelVersionId}...`);

        // Generate Test Cases (in real life, use a held-out validation set)
        // Here we simulate checking against a subset of training data or synthetic probes
        const testCases = trainingRecords.slice(0, 5).map(r => ({
            input: r.inputText,
            shouldRefuse: r.expectedOutput.includes("refuse") || r.expectedOutput.includes("cannot"),
            model_output: r.expectedOutput // In real life, we'd GENERATE this using the new model
        }));

        // 1. Refusal Accuracy
        await evaluationService.evaluateRefusalAccuracy(modelVersionId, testCases);

        // 2. Policy Violations
        await evaluationService.evaluatePolicyViolations(modelVersionId, testCases);

        // Check if it passes gates
        const isReady = await evaluationService.validateModelReadiness(modelVersionId);

        if (isReady) {
            console.log(`[TrainingManager] Model ${modelVersionId} PASSED evaluation. Deploying...`);
            await prisma.modelVersion.update({
                where: { id: modelVersionId },
                data: {
                    status: 'DEPLOYED',
                    deployedAt: new Date()
                }
            });
        } else {
            console.warn(`[TrainingManager] Model ${modelVersionId} FAILED evaluation.`);
            await prisma.modelVersion.update({
                where: { id: modelVersionId },
                data: { status: 'DEPRECATED' } // Park it
            });
        }
    }
}

export const trainingManager = new TrainingManager();
