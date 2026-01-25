
import { prisma } from "@/lib/db";
import { DatasetStatus, TrainingTaskType, DatasetReview } from "@prisma/client";

/**
 * Stage 2 Schema (User Defined)
 */
export interface TrainingRecordData {
    task_type: TrainingTaskType;
    input_text: string;
    brand_rules: {
        tone: string;
        forbidden_phrases: string[];
        signature_required: boolean;
    };
    policy_rules: {
        no_pressure: boolean;
        no_guarantees: boolean;
        whatsapp_requires_consent: boolean;
    };
    expected_output: string;
    rejection_conditions: string[];
}

export class DatasetService {

    /**
     * Stage 1: Create Dataset restricted to allowed Task Taxonomy
     */
    async createDataset(taskType: TrainingTaskType, version: string) {
        return await prisma.trainingDataset.create({
            data: {
                taskType,
                version,
                datasetHash: "pending", // To be calculated on freeze
                configHash: "pending",
                status: DatasetStatus.DRAFT
            }
        });
    }

    /**
     * Stage 2: Add Record enforcing Schema
     */
    async addRecord(datasetId: string, record: TrainingRecordData) {
        return await prisma.trainingRecord.create({
            data: {
                datasetId,
                taskType: record.task_type,
                inputText: record.input_text,
                brandRules: record.brand_rules,
                policyRules: record.policy_rules,
                expectedOutput: record.expected_output,
                rejectionConditions: record.rejection_conditions
            }
        });
    }

    /**
     * Stage 5: Human Review & Scoring
     */
    async reviewDataset(datasetId: string, reviewerId: string, sampleSize: number,
        scores: { policy: number, tone: number, clarity: number, realism: number }) {

        const avgScore = (scores.policy + scores.tone + scores.clarity + scores.realism) / 4;
        const approved = avgScore >= 4.0; // Stage 5 Rule: <4 -> Fix or Delete (Here we reject)

        await prisma.datasetReview.create({
            data: {
                datasetId,
                reviewerId,
                sampleSize,
                avgScore,
                policyCorrectness: scores.policy,
                toneQuality: scores.tone,
                clarity: scores.clarity,
                realism: scores.realism,
                approved,
                notes: approved ? "Automated Approval based on score" : "Quality Threshold Failed"
            }
        });

        // Trigger State Transition
        if (approved) {
            await prisma.trainingDataset.update({
                where: { id: datasetId },
                data: { status: DatasetStatus.REVIEWED }
            });
        }

        return { approved, avgScore };
    }

    /**
     * Transition to TRAINING (Stage 6)
     * Only allowed if REVIEWED
     */
    async approveDataset(datasetId: string) {
        const dataset = await prisma.trainingDataset.findUnique({
            where: { id: datasetId },
            include: { reviews: true }
        });

        if (!dataset) throw new Error("Dataset not found");

        // Strict Check: Must have passing review
        const hasPassingReview = dataset.reviews.some(r => r.approved);
        if (!hasPassingReview) {
            throw new Error("Dataset must pass Stage 5 Human Review before training.");
        }

        return await prisma.trainingDataset.update({
            where: { id: datasetId },
            data: { status: DatasetStatus.TRAINING }
        });
    }

    async getDataset(datasetId: string) {
        return prisma.trainingDataset.findUnique({ where: { id: datasetId } });
    }
}

export const datasetService = new DatasetService();
