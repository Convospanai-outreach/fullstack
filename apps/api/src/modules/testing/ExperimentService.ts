
import { prisma } from "@/lib/db";
import { ExperimentVariant } from "@prisma/client";
import { createHash } from "crypto";

export class ExperimentService {
    /**
     * Creates a new A/B experiment
     */
    async createExperiment(teamId: string, name: string, goal: string, variants: { name: string, config: any }[]) {
        if (variants.length < 2) throw new Error("Experiments must have at least 2 variants");

        return await prisma.experiment.create({
            data: {
                teamId,
                name,
                goal,
                status: "RUNNING",
                variants: {
                    create: variants.map(v => ({
                        name: v.name,
                        config: v.config
                    }))
                }
            },
            include: { variants: true }
        });
    }

    /**
     * Deterministically assigns a variant for a given user/entity
     * Uses hashing to ensure the same entity always gets the same variant
     */
    async getVariant(experimentId: string, entityId: string): Promise<ExperimentVariant | null> {
        const experiment = await prisma.experiment.findUnique({
            where: { id: experimentId },
            include: { variants: true }
        });

        if (!experiment || experiment.status !== 'RUNNING' || experiment.variants.length === 0) {
            console.warn(`[ExperimentService] Experiment ${experimentId} not active/found. Falling back to CONTROL variant.`);
            return {
                id: 'baseline-control',
                experimentId: experimentId,
                name: 'CONTROL',
                config: { fallback: true },
                sampleCount: 0,
                successCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            } as ExperimentVariant;
        }

        // Deterministic Assignment: Hash(experimentId + entityId) % numVariants
        const hash = createHash('sha256').update(`${experimentId}:${entityId}`).digest('hex');
        const index = parseInt(hash.substring(0, 8), 16) % experiment.variants.length;

        return experiment.variants[index] || null;
    }

    /**
     * Records that an entity was exposed to a variant
     */
    async recordExposure(variantId: string) {
        await prisma.experimentVariant.update({
            where: { id: variantId },
            data: { sampleCount: { increment: 1 } }
        });
    }

    /**
     * Records a successful outcome for a variant
     */
    async recordSuccess(variantId: string, weight: number = 1) {
        await prisma.experimentVariant.update({
            where: { id: variantId },
            data: { successCount: { increment: weight } }
        });
    }

    /**
     * Aggregates results for an experiment
     */
    async getResults(experimentId: string) {
        const experiment = await prisma.experiment.findUnique({
            where: { id: experimentId },
            include: { variants: true }
        });

        if (!experiment) return null;

        return experiment.variants.map(v => ({
            name: v.name,
            samples: v.sampleCount,
            successes: v.successCount,
            conversionRate: v.sampleCount > 0 ? (v.successCount / v.sampleCount) : 0
        }));
    }

    /**
     * Finds active experiments for a team
     */
    async getActiveExperiments(teamId: string) {
        return await prisma.experiment.findMany({
            where: { teamId, status: 'RUNNING' }
        });
    }
}

export const experimentService = new ExperimentService();
