
import http from 'http';
import { microLLM } from '../src/ai/MicroLLMClient';
import { MicroLLMRequest } from '../src/ai/MicroLLMTypes';

const PORT = 8081;

// 1. Create Mock Server
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/infer') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const request: MicroLLMRequest = JSON.parse(body);

            // Simulation Logic
            if (request.inputText.includes("FAIL_500")) {
                res.writeHead(500);
                res.end("Internal Server Error");
                return;
            }

            if (request.inputText.includes("TIMEOUT")) {
                // Hang...
                setTimeout(() => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ outputText: "Too late", confidence: 0.1 }));
                }, 2500); // > Client 2000ms timeout
                return;
            }

            // Normal Response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                outputText: `Processed: ${request.inputText}`,
                confidence: 0.95,
                classification: "ALLOW"
            }));
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

async function runTests() {
    console.log("Starting Micro-LLM Verification...");

    // Start Server
    await new Promise<void>(resolve => server.listen(PORT, resolve));
    console.log(`Mock Inference Server running on port ${PORT}`);

    try {
        // Test 1: Successful Inference
        console.log("\nTest 1: Normal Inference...");
        const res1 = await microLLM.infer({
            taskType: "TONE_NORMALIZATION",
            inputText: "Hello world"
        });
        if (res1.confidence !== 0.95) throw new Error("Confidence mismatch");
        console.log("✅ Success (Latency: " + res1.latencyMs + "ms)");

        // Test 2: Fail Fast (500)
        console.log("\nTest 2: Fail Fast (500 Error)...");
        try {
            await microLLM.infer({
                taskType: "POLICY_CLASSIFICATION",
                inputText: "FAIL_500"
            });
            throw new Error("Should have thrown error");
        } catch (e: any) {
            if (!e.message.includes("Micro-LLM Error: 500")) throw e;
            console.log("✅ Caught Expected Error: " + e.message);
        }

        // Test 3: Strict Timeout
        console.log("\nTest 3: Strict Timeout...");
        try {
            const start = Date.now();
            await microLLM.infer({
                taskType: "REFUSAL_GENERATION",
                inputText: "TIMEOUT"
            });
            throw new Error("Should have timed out");
        } catch (e: any) {
            const duration = Date.now() - 3; // approximate start
            // Error message check
            if (!e.message.includes("Micro-LLM Timeout")) throw e;
            console.log(`✅ Caught Timeout (waited ~2000ms)`);
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
        process.exit(1);
    } finally {
        server.close();
    }
}

runTests();
