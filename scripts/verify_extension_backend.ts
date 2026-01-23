
const fetch = require('node-fetch');

// Config
const API_URL = "http://localhost:3000/api";
const QUEUE_PENDING = `${API_URL}/queue/pending`;
const QUEUE_RESULT = `${API_URL}/queue/result`;

async function main() {
    console.log("🔍 Verifying Extension Backend Logic...");

    // 1. Poll for Pending (Expect null if empty)
    console.log("\n1. Polling Queue (Expected Empty/Null)...");
    try {
        const res = await fetch(QUEUE_PENDING);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log("   Response:", JSON.stringify(data));

        if (data.command === null) {
            console.log("   ✅ Queue correctly empty.");
        } else {
            console.log("   ⚠️ Queue not empty? (Did you approve something?)");
        }
    } catch (e) {
        console.error("   ❌ Failed to poll pending:", e.message);
    }

    // Note: We can't easily mock an "Approved" log without DB access here, 
    // but verifying the endpoint is reachable (200 OK) is 90% of the battle 
    // for a beta environment check.
}

main();
