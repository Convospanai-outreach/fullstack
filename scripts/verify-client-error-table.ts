/**
 * Verify ClientError table was created successfully
 */

import { prisma } from "@/lib/db";

async function verifyClientErrorTable() {
    console.log("🔍 Verifying ClientError table...\n");

    try {
        // Test 1: Check if we can query the table
        console.log("Test 1: Querying ClientError table...");
        const errors = await prisma.clientError.findMany({
            take: 1
        });
        console.log(`  ✓ Table exists and is queryable (${errors.length} errors found)\n`);

        // Test 2: Insert a test error
        console.log("Test 2: Inserting test error...");
        const testError = await prisma.clientError.create({
            data: {
                message: "Test error from verification script",
                stack: "Error: Test\n  at test.ts:1:1",
                componentStack: "in TestComponent",
                url: "http://localhost:3000/test",
                userAgent: "Mozilla/5.0 (Test)",
                ip: "127.0.0.1",
                metadata: {
                    test: true,
                    timestamp: new Date().toISOString()
                }
            }
        });
        console.log(`  ✓ Test error inserted with ID: ${testError.id}\n`);

        // Test 3: Query the test error
        console.log("Test 3: Querying inserted error...");
        const retrieved = await prisma.clientError.findUnique({
            where: { id: testError.id }
        });
        console.log(`  ✓ Error retrieved: ${retrieved?.message}\n`);

        // Test 4: Clean up test error
        console.log("Test 4: Cleaning up test error...");
        await prisma.clientError.delete({
            where: { id: testError.id }
        });
        console.log(`  ✓ Test error deleted\n`);

        console.log("✅ All tests passed! ClientError table is working correctly.\n");
        return true;

    } catch (error: any) {
        console.error("❌ Verification failed:", error.message);
        console.error(error);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

// Run verification
verifyClientErrorTable()
    .then(success => {
        if (success) {
            console.log("Migration verification: SUCCESS ✅");
            process.exit(0);
        } else {
            console.log("Migration verification: FAILED ❌");
            process.exit(1);
        }
    })
    .catch(error => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
