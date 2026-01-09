
import { ScoringSimulator } from "./simulator";
import { RevenueVelocityService } from "../service/RevenueVelocityService";

// Mock Legacy Scorer (Weighted Sum)
class LegacyScorer {
    score = 0;
    handleEvent(type: string) {
        if (type === "PAGE_VIEW") this.score += 5;
        if (type === "CLICK") this.score += 10;
    }
}

async function runBenchmark() {
    const sim = new ScoringSimulator();
    const velocityService = new RevenueVelocityService();

    console.log("--- STARTING BENCHMARK: Revenue Velocity vs Legacy ---");

    // Scenario 1: High Intent Burst
    const highIntentEvents = sim.generateHighIntentProfile("lead-1", new Date());

    let legacyScore = 0;
    let velocityScore = 0.5; // Initial prior

    console.log("\nScenario 1: High Intent Burst");
    console.log("Time Offset | Event | Legacy Score | Velocity Score");

    const startTime = highIntentEvents[0].timestamp.getTime();

    for (const event of highIntentEvents) {
        // Legacy Update
        if (event.type === "PAGE_VIEW") legacyScore += 5;
        if (event.type === "CLICK") legacyScore += 10;

        // Velocity Update (Mocking the service call structure)
        // In real app, we'd persist to DB, here we simulate the stateless math
        // Assuming calculateVelocity returns the new posterior
        const timeDelta = (event.timestamp.getTime() - startTime) / (1000 * 60 * 60); // hours

        // Simulate decay since start (simplified)
        const decayed = velocityScore * Math.pow(0.9, timeDelta);

        // Update
        velocityScore = velocityService.calculateVelocity(decayed + 0.1, 0.8, 1); // Mock params

        const offsetMins = Math.floor((event.timestamp.getTime() - startTime) / 60000);
        console.log(`${offsetMins}m | ${event.type} | ${legacyScore} | ${velocityScore.toFixed(4)}`);
    }
}

// runBenchmark();
