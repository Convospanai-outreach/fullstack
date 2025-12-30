import { generateWithGemini } from "@/ai/gemini";
// import { prisma } from "@/lib/prisma"; // Assuming we do RAG here too eventually

export interface AgentToneConfig {
  formality: number; // 0-100
  directness: number; // 0-100
  talkingPoints: string[];
  avoidWords: string[];
}

// Helper to translate numerical sliders to prompt instructions
function getConfigInstructions(config?: AgentToneConfig): string {
  if (!config) return "";

  const formalityLevel = config.formality > 70 ? "Formal, professional, and polite" : config.formality < 30 ? "Casual, friendly, and conversational" : "Balanced professionalism";
  const directnessLevel = config.directness > 70 ? "Get straight to the point, concise, no fluff" : config.directness < 30 ? "Consultative, exploratory, soft approach" : "Clear but engaging";

  let instructions = `
  TONE INSTRUCTIONS:
  - Formality: ${config.formality}/100 -> ${formalityLevel}
  - Directness: ${config.directness}/100 -> ${directnessLevel}
  `;

  if (config.talkingPoints?.length) {
    instructions += `\nCRITICAL TALKING POINTS (You MUST mention these):\n- ${config.talkingPoints.join("\n- ")}`;
  }

  if (config.avoidWords?.length) {
    instructions += `\nFORBIDDEN WORDS (Do NOT use these): ${config.avoidWords.join(", ")}`;
  }

  return instructions;
}

export async function generateResponse(
  context: string,
  mission: string,
  config?: AgentToneConfig
): Promise<string> {
  const toneInstructions = getConfigInstructions(config);

  const prompt = `
  MISSION:
  ${mission}

  CONTEXT:
  ${context}

  ${toneInstructions}

  Respond as the AI Agent following these constraints strictly.
  `;

  return generateWithGemini(prompt);
}
