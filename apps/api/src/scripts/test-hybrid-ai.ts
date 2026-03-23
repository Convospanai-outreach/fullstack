
import { HybridRouter, AIDestination, AITaskType, AIContext } from "../lib/ai/HybridRouter";
import { ProductMode } from "@prisma/client";

async function testHybridRouting() {
    console.log("Starting Hybrid AI Routing Verification...\n");

    const tests: Array<{ name: string; context: AIContext; expected: AIDestination }> = [
        {
            name: "Email Draft (No PII) -> Cloud",
            context: {
                taskType: AITaskType.EMAIL_DRAFT,
                containsPII: false,
                productMode: ProductMode.GROWTH
            },
            expected: AIDestination.CLOUD
        },
        {
            name: "LinkedIn Message -> On-Prem",
            context: {
                taskType: AITaskType.LINKEDIN_MESSAGE,
                containsPII: false,
                requiresResidentialIP: true
            },
            expected: AIDestination.ON_PREM
        },
        {
            name: "Lead Enrichment with PII -> On-Prem",
            context: {
                taskType: AITaskType.LEAD_ENRICHMENT,
                containsPII: true
            },
            expected: AIDestination.ON_PREM
        },
        {
            name: "RAG Query (Public Docs) -> Cloud",
            context: {
                taskType: AITaskType.RAG_QUERY,
                containsPII: false
            },
            expected: AIDestination.CLOUD
        },
        {
            name: "Summary Generation -> Cloud",
            context: {
                taskType: AITaskType.SUMMARY,
                containsPII: false
            },
            expected: AIDestination.CLOUD
        },
        {
            name: "Scraping Task -> On-Prem",
            context: {
                taskType: AITaskType.SCRAPING
            },
            expected: AIDestination.ON_PREM
        },
        {
            name: "Enterprise Core + Compliance -> On-Prem",
            context: {
                taskType: AITaskType.EMAIL_DRAFT,
                productMode: ProductMode.ENTERPRISE_CORE,
                isComplianceSensitive: true
            },
            expected: AIDestination.ON_PREM
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        const result = await HybridRouter.route(test.context);
        const success = result.destination === test.expected;

        if (success) {
            console.log(`✓ PASS: ${test.name}`);
            console.log(`  Routed to: ${result}\n`);
            passed++;
        } else {
            console.error(`✗ FAIL: ${test.name}`);
            console.error(`  Expected: ${test.expected}, Got: ${result}\n`);
            failed++;
        }
    }

    // Test PII Detection
    console.log("Testing PII Detection in Cloud Requests...\n");

    const piiTests = [
        { prompt: "Email john.doe@example.com about the meeting", shouldFail: true },
        { prompt: "His SSN is 123-45-6789", shouldFail: true },
        { prompt: "Call 5551234567 for details", shouldFail: true },
        { prompt: "Draft an email about our product features", shouldFail: false }
    ];

    for (const test of piiTests) {
        try {
            HybridRouter.validateCloudSafety(AIDestination.CLOUD, test.prompt);
            if (test.shouldFail) {
                console.error(`✗ FAIL: PII not detected in: "${test.prompt.substring(0, 50)}..."`);
                failed++;
            } else {
                console.log(`✓ PASS: No PII in: "${test.prompt.substring(0, 50)}..."`);
                passed++;
            }
        } catch (error) {
            if (test.shouldFail) {
                console.log(`✓ PASS: PII detected and blocked: "${test.prompt.substring(0, 50)}..."`);
                passed++;
            } else {
                console.error(`✗ FAIL: False positive PII detection: "${test.prompt.substring(0, 50)}..."`);
                failed++;
            }
        }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log(`${"=".repeat(50)}`);

    if (failed === 0) {
        console.log("\n🎉 All Hybrid AI tests passed!");
    } else {
        console.error(`\n❌ ${failed} test(s) failed`);
        process.exit(1);
    }
}

await testHybridRouting();
