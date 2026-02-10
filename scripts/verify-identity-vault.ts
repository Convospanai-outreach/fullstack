
import { IdentityService } from "../src/modules/identity/IdentityService";
import { createHmac } from "crypto";

async function main() {
    console.log("=== Verifying Identity Vault ===");

    // 1. Test Re-identification (Mock Fallback)
    console.log("\n1. Testing Re-identification...");
    const maskedId = "MASKED_12345";
    const teamId = "team_test";
    try {
        const pii = await IdentityService.resolveIdentity(maskedId, "AUDIT_TEST", teamId);
        console.log("Resolved PII:", pii);
        if (pii.email === "restored.12345@example.com") {
            console.log("PASS: Re-identification logic works.");
        } else {
            console.error("FAIL: Unexpected PII result.");
        }
    } catch (e) {
        console.error("FAIL: Re-identification threw error", e);
    }

    // 2. Test Webhook Signature Verification
    console.log("\n2. Testing Webhook Verification...");
    const secret = "default-secret-dev"; // Matching the fallback in route.ts
    const payload = { event: "TEST_EVENT", user_id: "u_123" };

    // Generate valid signature
    const validSignature = createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    const isValid = IdentityService.verifyWebhook(payload, validSignature, secret);
    if (isValid) {
        console.log("PASS: Valid signature accepted.");
    } else {
        console.error("FAIL: Valid signature rejected.");
    }

    // Test Invalid Signature
    const isInvalid = IdentityService.verifyWebhook(payload, "bad_signature", secret);
    if (!isInvalid) {
        console.log("PASS: Invalid signature rejected.");
    } else {
        console.error("FAIL: Invalid signature accepted.");
    }
}

main().catch(console.error);
