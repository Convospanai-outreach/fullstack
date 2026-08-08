declare module '@google/generative-ai' {
  export class GoogleGenerativeAI {
    constructor(apiKey?: string);
    getGenerativeModel(opts?: { model?: string }): {
      generateContent(prompt: string): Promise<{ response: { text(): string } }>;
    };
  }
  export default GoogleGenerativeAI;
}
