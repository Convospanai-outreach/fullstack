/**
 * Training Manager Service - Enterprise ML Training
 *
 * Orchestrates the fine-tuning lifecycle:
 * 1. Validates Dataset (Must be REVIEWED)
 * 2. Prepares Training Job (JSONL export, etc.)
 * 3. Triggers Fine-Tuning via a real provider API
 * 4. Polling & Status Updates
 * 5. Triggers Post-Training Evaluation
 *
 * No fine-tuning provider is wired up yet, so startTraining fails fast with a
 * clear error instead of fabricating progress/evaluation results and writing
 * a fake ModelVersion row.
 */

import { prisma } from "@/lib/db";

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

        throw new Error(
            "Fine-tuning is not implemented: no training provider (OpenAI/Gemini fine-tuning API) is configured. " +
            `Refusing to start training for dataset ${dataset.version} with base model ${baseModel}.`
        );
    }
}

export const trainingManager = new TrainingManager();
