import { HybridRouter, AITaskType } from "./src/lib/ai/HybridRouter";
import { v4 as uuidv4 } from "uuid";

async function testRouterLoad() {
    const CONCURRENT_REQUESTS = 500;
    console.log(`🚀 Starting AI Router Load Test: ${CONCURRENT_REQUESTS} concurrent requests`);

    const start = performance.now();
    
    const tasks = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, i) => {
        const containsPII = i % 2 === 0;
        const taskType = i % 3 === 0 ? AITaskType.EMAIL_DRAFT : AITaskType.SUMMARY;
        
        try {
            // This invokes health checks (cached) and routing logic
            const result = await HybridRouter.route({
                taskType,
                containsPII,
                productMode: "ENTERPRISE_CORE",
                isComplianceSensitive: true
            });
            return { success: true, destination: result.destination };
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    });

    const results = await Promise.all(tasks);
    const end = performance.now();
    const duration = (end - start) / 1000;

    const success = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    const blockedPII = results.filter(r => !r.success && r.error?.includes("Sovereign Node Offline")).length;

    console.log(`\n✅ Finished in ${duration.toFixed(3)}s`);
    console.log(`Throughput: ${(CONCURRENT_REQUESTS / duration).toFixed(2)} req/sec`);
    console.log(`Successful Routes: ${success}`);
    console.log(`Blocked (Safe-Closed) PII: ${blockedPII}`);
    console.log(`Other Failures: ${failures - blockedPII}`);
}

testRouterLoad().catch(console.error).finally(() => process.exit(0));
