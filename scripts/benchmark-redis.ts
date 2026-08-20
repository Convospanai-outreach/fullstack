import { FeatureFlagService } from "./src/lib/flags/service";
import { prisma } from "./src/lib/db";
import { v4 as uuidv4 } from "uuid";

async function benchmark() {
    console.log("🚀 Starting Performance Benchmark: Redis Caching vs Database...");
    
    // Create a test team
    const teamId = "bench-" + uuidv4().substring(0, 8);
    await prisma.team.create({
        data: {
            id: teamId,
            name: "Benchmark Team",
            organizationPolicy: {
                create: {
                    productMode: "ENTERPRISE_CORE"
                }
            }
        }
    });

    const featureKey = "linkedin_automation"; // Defined in config
    
    // 1. Cold Run (Database hit)
    console.log("--- Cold Run (DB) ---");
    const startCold = performance.now();
    for(let i=0; i<5; i++) {
        // Clear cache if we want to force DB every time here, 
        // but the first one will be DB anyway.
        await FeatureFlagService.isEnabled(featureKey, teamId);
    }
    const endCold = performance.now();
    const coldAvg = (endCold - startCold) / 5;
    console.log(`Average Cold Time (DB): ${coldAvg.toFixed(2)}ms`);

    // 2. Hot Run (Redis hit)
    console.log("--- Hot Run (Redis) ---");
    const startHot = performance.now();
    const iterations = 1000;
    for(let i=0; i<iterations; i++) {
        await FeatureFlagService.isEnabled(featureKey, teamId);
    }
    const endHot = performance.now();
    const hotAvg = (endHot - startHot) / iterations;
    console.log(`Average Hot Time (Redis): ${hotAvg.toFixed(4)}ms`);
    
    const speedup = coldAvg / hotAvg;
    console.log(`\n✅ Results: Redis is ${speedup.toFixed(1)}x faster than DB.`);
    
    // Total throughput simulation
    console.log(`\nSimulated Throughput: ${Math.round(1000 / hotAvg)} req/sec (Single Threaded)`);
}

benchmark()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
