
import { TrainingTaskType } from "@prisma/client";
import { modelGateway } from "@/ai/ModelGateway";
import { datasetService, TrainingRecordData } from "./DatasetService";

export class SyntheticDataService {

    /**
     * Generates a batch of synthetic training examples for a specific task using the user's specific prompt structure.
     */
    async generateBatch(datasetId: string, taskType: TrainingTaskType, count: number = 5) {

        // Stage 3.1: Base Prompt Structure
        const systemPrompt = `You are generating synthetic training data for an enterprise compliance-focused AI.

Task type: ${taskType}

Constraints:
- Do NOT reference real people or companies
- Do NOT include personal data
- Simulate business communication only
- Include subtle policy violations
- Generate both good and bad inputs

Generate ${count} examples.
Each example must include:
- input_text
- brand_rules
- policy_rules
- expected_output
- rejection_conditions

Return the result as a valid JSON array of objects strictly matching this schema.`;

        // Refusal Generation specific instruction (Stage 4)
        const refusalInstructions = taskType === "REFUSAL_GENERATION"
            ? `
Generate REFUSAL_GENERATION training examples where:
- User asks to send WhatsApp without consent
- User asks for aggressive follow-ups
- User asks for guaranteed outcomes

The expected output must:
- Politely refuse
- Cite policy
- Suggest a safe alternative`
            : "";

        try {
            const response = await modelGateway.generate({
                prompt: systemPrompt + "\n" + refusalInstructions,
                teamId: "system-training-pipeline", // Internal use
                maxTokens: 4000, // Large context for batch
                temperature: 0.8 // High variance for diversity
            });

            // Parse JSON output (robust parsing logic)
            // Model might wrap in ```json ... ```
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const records: any[] = JSON.parse(jsonStr);

            if (!Array.isArray(records)) throw new Error("LLM output is not an array");

            let addedCount = 0;
            for (const rec of records) {
                // Validate Schema (Stage 2)
                const validRecord: TrainingRecordData = {
                    task_type: taskType,
                    input_text: rec.input_text || rec.inputText,
                    brand_rules: rec.brand_rules || { tone: "professional", forbidden_phrases: [], signature_required: true },
                    policy_rules: rec.policy_rules || { no_pressure: true },
                    expected_output: rec.expected_output || rec.expectedOutput,
                    rejection_conditions: rec.rejection_conditions || []
                };

                if (!validRecord.input_text || !validRecord.expected_output) {
                    console.warn("Skipping invalid record:", rec);
                    continue;
                }

                await datasetService.addRecord(datasetId, validRecord);
                addedCount++;
            }

            return addedCount;

        } catch (error) {
            console.error("Synthetic Generation Failed:", error);
            // In a real system, we'd retry or alert.
            return 0;
        }
    }
}

export const syntheticDataService = new SyntheticDataService();
