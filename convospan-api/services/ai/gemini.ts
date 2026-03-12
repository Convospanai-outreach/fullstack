import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"]! || "");

export const generateWithGemini = async (prompt: string, modelName: string = "gemini-1.5-flash") => {
  if (!process.env["GEMINI_API_KEY"] || process.env["NODE_ENV"] === "test") {
    console.log(`[Gemini Mock] Generating mock response for: ${prompt.substring(0, 50)}...`);
    return `Mock Gemini response for: ${prompt.substring(0, 100)}`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const getEmbeddings = async (text: string, modelName: string = "text-embedding-004") => {
  if (!process.env["GEMINI_API_KEY"] || process.env["NODE_ENV"] === "test") {
    // Return a stable mock vector based on text length/content
    return Array.from({ length: 1536 }, (_, i) => (text.length + i) % 100 / 100);
  }

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    return [];
  }
};
