
import { PIIScrubber } from '../src/lib/governance/PIIScrubber';
import { LinkedInConstants } from '../src/modules/linkedin-runner/service/LinkedInConstants';
import { Humanizer } from '../src/modules/linkedin-runner/service/Humanizer';

async function runTests() {
    console.log("🔒 Starting Platform Hardening Verification...\n");

    // 1. PII Scrubber Test
    console.log("--- TEST 1: PII Scrubber ---");
    const piiSamples = [
        "Contact me at test.user@example.com for details.",
        "My number is 555-123-4567, call me.",
        "CC: 4444-5555-6666-7777 is my card.",
        "SSN: 123-45-6789 (do not share)",
        "Safe text: Hello world, no secrets here."
    ];

    let piiFailures = 0;
    for (const sample of piiSamples) {
        if (PIIScrubber.containsPII(sample)) {
            const redacted = PIIScrubber.scrub(sample);
            if (redacted === sample && sample.includes("Safe text")) {
                console.log(`✅ [Safe] Correctly ignored safe text`);
            } else if (redacted !== sample) {
                console.log(`✅ [Redacted] "${sample}" -> "${redacted}"`);
            } else {
                console.error(`❌ [Failed] Detected but didn't redact: "${sample}"`);
                piiFailures++;
            }
        } else {
            if (sample.includes("Safe text")) {
                console.log(`✅ [Ignored] Safe text ignored as expected.`);
            } else {
                console.error(`❌ [Failed] Detection missed: "${sample}"`);
                piiFailures++;
            }
        }
    }

    if (piiFailures === 0) console.log(">> PII Scrubber: PASSED\n");
    else console.log(`>> PII Scrubber: FAILED (${piiFailures} errors)\n`);

    // 2. LinkedIn Constants Test
    console.log("--- TEST 2: LinkedIn Constants ---");
    if (LinkedInConstants.SELECTORS.CONNECT_BTN.length > 0 &&
        LinkedInConstants.SELECTORS.SEND_BTN.length > 0) {
        console.log(`✅ Selectors loaded correctly. Connect variants: ${LinkedInConstants.SELECTORS.CONNECT_BTN.length}`);
        console.log(">> Constants: PASSED\n");
    } else {
        console.error("❌ Constants missing selectors.");
        console.log(">> Constants: FAILED\n");
    }

    // 3. Humanizer Smoke Test
    console.log("--- TEST 3: Humanizer (Simulation) ---");
    const start = Date.now();
    console.log("Simulating random delay (1-2s)...");
    await Humanizer.randomDelay(1, 2);
    const duration = (Date.now() - start) / 1000;

    if (duration >= 1 && duration <= 2.2) { // 2.2 buffer for execution time
        console.log(`✅ Delay respected: ${duration.toFixed(2)}s`);
        console.log(">> Humanizer: PASSED\n");
    } else {
        console.error(`❌ Delay out of bounds: ${duration.toFixed(2)}s`);
        console.log(">> Humanizer: FAILED\n");
    }

    console.log("🎉 Verification Complete.");
}

runTests().catch(console.error);
