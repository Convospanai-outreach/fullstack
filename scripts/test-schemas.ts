
import { createLeadSchema, createCampaignSchema } from "../src/lib/validation/schemas";

async function testSchemas() {
    console.log("Validation Schemas...");

    // 1. Test Lead Schema
    const leadInput = {
        fullName: "Test Lead",
        email: "test@example.com",
        linkedIn: "https://linkedin.com/in/test",
        status: "NEW",
        privacyAck: true // Extra field should be stripped or ignored if safeParse
    };

    const leadResult = createLeadSchema.safeParse(leadInput);
    if (!leadResult.success) {
        console.error("❌ Lead Schema Failed:", leadResult.error.format());
    } else {
        console.log("✅ Lead Schema Passed");
        if (leadResult.data.linkedIn !== leadInput.linkedIn) {
            console.warn("⚠️ Lead LinkedIn field mismatch or transformation occurred.");
        }
    }

    // 2. Test Campaign Schema
    const campaignInput = {
        name: "Q1 Campaign",
        type: "smart",
        scheduledStart: new Date().toISOString(),
        aiConfig: {
            executionMode: "autonomous",
            tone: "professional"
        }
    };

    const campaignResult = createCampaignSchema.safeParse(campaignInput);
    if (!campaignResult.success) {
        console.error("❌ Campaign Schema Failed:", campaignResult.error.format());
    } else {
        console.log("✅ Campaign Schema Passed");
    }

    // 3. Test Invalid Input
    const invalidLead = {
        email: "not-an-email"
    };
    const invalidResult = createLeadSchema.safeParse(invalidLead);
    if (!invalidResult.success) {
        console.log("✅ Invalid Lead correctly rejected");
    } else {
        console.error("❌ Invalid Lead ILLEGALLY ACCEPTED");
    }
}

testSchemas();
