import { HardwareService } from '../src/services/HardwareService';
import { AgentExecutor, AgentState } from '../src/modules/agent/core/AgentExecutor';

async function main() {
    console.log("Starting CraftMyFunnel Edge Verification...");

    // 1. Test Hardware Handshake
    try {
        await HardwareService.verifyHardwareIdentity();
        console.log("✅ Hardware Handshake SUCCESS");
    } catch (e: any) {
        console.error("❌ Hardware Handshake FAILED: " + e.message);
        process.exit(1);
    }

    // 2. Test Sanitization
    try {
        const piiText = "My email is john.doe@example.com and PAN is ABCDE1234F";
        console.log(`Sending PII: "${piiText}"`);
        const res = await HardwareService.sanitize(piiText);
        console.log(`✅ Sanitization Result: "${res.sanitized_text}"`);
        if (res.sanitized_text.includes("john.doe")) {
            console.error("❌ PII Leak Detected!");
        }
    } catch (e: any) {
        console.error("❌ Sanitization Failed: " + e.message);
    }

    console.log("Verification Complete.");
}

main().catch(console.error);
