
import { aiService } from "../lib/aiService";
import { config } from "dotenv";

// Load env vars
config();

async function verifyAI() {
    console.log("🤖 Verifying AI Service...");

    // Check key
    const key = process.env['GEMINI_API_KEY'];
    if (!key) {
        console.error("❌ GEMINI_API_KEY is missing!");
        process.exit(1);
    }
    console.log("✅ GEMINI_API_KEY found (length: " + key.length + ")");

    try {
        console.log("Testing text generation with gemini-2.0-flash...");
        const response = await aiService.askAI("Explain how AI works in one sentence.");
        console.log("✅ AI Response:", response);

        console.log("\nTesting smart comment generation...");
        const comment = await aiService.generateComment(
            "Just launched our new product! Super excited to share it with the world. #launch #startup",
            "I am a software engineer interested in AI."
        );
        console.log("✅ Smart Comment:", comment);

        console.log("\n✨ AI Service Verification Successful!");
    } catch (error: any) {
        console.error("❌ AI Service failed:", error.message);
        if (error.message.includes("404")) {
            console.error("Tip: The model 'gemini-2.0-flash' might not be available in standard tier yet. Try 'gemini-pro' or 'gemini-1.5-flash'.");
        }
        process.exit(1);
    }
}

verifyAI();
