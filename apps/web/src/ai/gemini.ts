export async function generateWithGemini(prompt: string): Promise<string> {
    if (!process.env["GEMINI_API_KEY"]) {
        return `Mock Gemini response: ${prompt.slice(0, 80)}`;
    }
    return `Gemini response placeholder: ${prompt.slice(0, 80)}`;
}
