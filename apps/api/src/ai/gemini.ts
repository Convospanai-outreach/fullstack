import { aiService } from "@/lib/aiService";

export async function generateWithGemini(prompt: string): Promise<string> {
    return aiService.askAI(prompt);
}
