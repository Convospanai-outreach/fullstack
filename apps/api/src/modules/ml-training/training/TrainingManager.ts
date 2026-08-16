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
import * as crypto from "crypto";

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
                configHash: (() => {
                    return crypto.createHash('sha256')
                        .update(JSON.stringify({ baseModel, datasetVersion: dataset.version, recordCount: dataset.records.length }))
                        .digest('hex').substring(0, 16);
                })(),
                changelog: `[SIMULATED - no real fine-tuning API call is made] Automated training run based on dataset ${dataset.version}`,
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
        const adapter = this.getTrainingAdapter();
        await adapter.train(modelVersionId, records, {
            onComplete: async () => {
                console.log(`[TrainingManager] Training complete for ${modelVersionId}. Moving to VALIDATION.`);
                await prisma.modelVersion.update({
                    where: { id: modelVersionId },
                    data: { status: 'VALIDATION' }
                });
                await this.runPostTrainingEvaluation(modelVersionId, records);
            },
            onError: async (error: Error) => {
                console.error(`[TrainingManager] Training Job Failed:`, error);
                await prisma.modelVersion.update({
                    where: { id: modelVersionId },
                    data: {
                        status: 'ROLLED_BACK',
                        changelog: `Training Failed: ${error.message}`
                    }
                });
            }
        });
    }

    private getTrainingAdapter() {
        return {
            train: async (_id: string, records: any[], hooks: any) => {
                try {
                    console.log(`[TrainingManager] Exporting ${records.length} records to JSONL...`);
                    // Real implementation would upload dataset to Google Cloud Storage or OpenAI Files API here
                    
                    console.log(`[TrainingManager] Triggering Fine-Tuning Job with provider...`);
                    // Example API call logic (commented out until SDK is available)
                    // const response = await aiProvider.fineTuning.create({
                    //    training_file: fileId,
                    //    model: "gemini-1.5-flash"
                    // });

                    // Simulate the asynchronous nature of fine-tuning jobs (which take minutes/hours)
                    // For demo purpose, we use a accelerated simulation with chance of failure.
                    let progress = 0;
                    const interval = setInterval(async () => {
                        progress += Math.floor(Math.random() * 15) + 5; // non-linear progress
                        console.log(`[TrainingManager] Fine-Tuning Job ${_id} Progress: ${progress}%`);
                        
                        if (progress >= 100) {
                            clearInterval(interval);
                            
                            // Chance of failure for demo realism (e.g. poor dataset quality)
                            if (records.length < 15 && Math.random() > 0.8) {
                                hooks.onError(new Error("Convergence failure: Model loss diverged during second epoch. Check dataset diversity."));
                            } else {
                                hooks.onComplete();
                            }
                        }
                    }, 2500);

                } catch (error: any) {
                    hooks.onError(error);
                }
            }
        };
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
