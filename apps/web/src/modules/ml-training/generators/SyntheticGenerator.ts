/**
 * Synthetic Training Data Generator
 * 
 * Orchestrates generation of enterprise-safe training data using Gemini API.
 * All data is synthetic - no real customer information.
 */

import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { PROMPT_TEMPLATES, TARGET_RECORD_COUNTS, type TrainingTaskType } from "./PromptTemplates";
import type { TrainingRecordSchema } from "../types";

export class SyntheticDataGenerator {

    /**
     * Generate synthetic training records for a specific task type
     */
    async generateTaskData(
        taskType: TrainingTaskType,
        count: number = 25,
        teamId: string
    ): Promise<TrainingRecordSchema[]> {

        const prompt = PROMPT_TEMPLATES[taskType];

        console.log(`[SyntheticGen] Generating ${count} records for ${taskType}...`);

        // Call Gemini to generate synthetic data
        const response = await aiService.askAI(
            `${prompt}\n\nGenerate exactly ${count} examples in valid JSON format.`,
            teamId
        );

        // Parse response
        let records: any[];
        try {
            // Extract JSON from response (may be wrapped in markdown code blocks)
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\[([\s\S]*)\]/);
            const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
            records = JSON.parse(jsonStr);
        } catch (e) {
            console.error(`[SyntheticGen] Failed to parse response:`, e);
            throw new Error(`Failed to parse Gemini response for ${taskType}`);
        }

        // Validate each record
        const validatedRecords: TrainingRecordSchema[] = [];
        for (const record of records) {
            if (this.validateRecord(record, taskType)) {
                validatedRecords.push(record);
            } else {
                console.warn(`[SyntheticGen] Invalid record skipped:`, record);
            }
        }

        console.log(`[SyntheticGen] Validated ${validatedRecords.length}/${count} records`);

        return validatedRecords;
    }

    /**
     * Validate record schema compliance
     */
    private validateRecord(record: any, taskType: TrainingTaskType): boolean {
        if (!record.task_type || record.task_type !== taskType) return false;
        if (!record.input_text || typeof record.input_text !== 'string') return false;
        if (!record.brand_rules || typeof record.brand_rules !== 'object') return false;
        if (!record.policy_rules || typeof record.policy_rules !== 'object') return false;
        if (!record.expected_output || typeof record.expected_output !== 'string') return false;
        if (!Array.isArray(record.rejection_conditions)) return false;

        return true;
    }

    /**
     * Generate full dataset for a task type and save to database
     */
    async generateAndSaveDataset(
        taskType: TrainingTaskType,
        version: string,
        teamId: string
    ): Promise<string> {

        const targetCount = TARGET_RECORD_COUNTS[taskType];
        const batchSize = 25;
        const batches = Math.ceil(targetCount / batchSize);

        console.log(`[SyntheticGen] Generating ${targetCount} records in ${batches} batches...`);

        // Create dataset entry
        const dataset = await prisma.trainingDataset.create({
            data: {
                version,
                taskType,
                recordCount: 0,
                datasetHash: this.generateHash(version, taskType),
                configHash: this.generateConfigHash(),
                status: 'DRAFT'
            }
        });

        let totalGenerated = 0;

        // Generate in batches to avoid token limits
        for (let i = 0; i < batches; i++) {
            const batchCount = Math.min(batchSize, targetCount - totalGenerated);

            try {
                const records = await this.generateTaskData(taskType, batchCount, teamId);

                // Save to database
                for (const record of records) {
                    await prisma.trainingRecord.create({
                        data: {
                            datasetId: dataset.id,
                            taskType,
                            inputText: record.input_text,
                            brandRules: record.brand_rules,
                            policyRules: record.policy_rules,
                            expectedOutput: record.expected_output,
                            rejectionConditions: record.rejection_conditions
                        }
                    });
                    totalGenerated++;
                }

                console.log(`[SyntheticGen] Batch ${i + 1}/${batches} complete (${totalGenerated}/${targetCount})`);

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`[SyntheticGen] Batch ${i + 1} failed:`, error);
                // Continue with next batch
            }
        }

        // Update dataset record count
        await prisma.trainingDataset.update({
            where: { id: dataset.id },
            data: { recordCount: totalGenerated, status: 'IN_REVIEW' }
        });

        console.log(`[SyntheticGen] Dataset ${version} complete: ${totalGenerated} records`);

        return dataset.id;
    }

    private generateHash(version: string, taskType: string): string {
        return `${version}-${taskType}-${Date.now()}`;
    }

    private generateConfigHash(): string {
        return `config-${Date.now()}`;
    }
}

export const syntheticDataGenerator = new SyntheticDataGenerator();
