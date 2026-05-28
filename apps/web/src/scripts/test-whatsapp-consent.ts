
import { ConsentService, ConsentMethod } from "../modules/whatsapp/ConsentService";
import { TemplateGuard } from "../modules/whatsapp/TemplateGuard";
import { prisma } from "../lib/db";

async function testWhatsAppConsent() {
    console.log("Starting WhatsApp Consent & Template Verification...\n");

    // Setup: Get or create a lead and user
    let lead = await prisma.lead.findFirst({ where: { email: "test.lead@example.com" } });
    if (!lead) {
        lead = await prisma.lead.create({
            data: {
                email: "test.lead@example.com",
                pipelineState: "COLD"
            }
        });
    }

    let user = await prisma.user.findFirst({ where: { email: "caller@test.com" } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: "caller@test.com",
                enterpriseRole: "SALES_USER"
            }
        });
    }

    console.log(`Using Lead: ${lead.id}, User: ${user.id}\n`);

    // Test 1: Validate consent before recording (should fail)
    console.log("Test 1: Validate consent before recording...");
    const initialCheck = await ConsentService.validateConsent(lead.id);
    if (!initialCheck.hasConsent) {
        console.log("✓ PASS: No consent initially\n");
    } else {
        console.error("✗ FAIL: Should not have consent initially\n");
    }

    // Test 2: Record consent
    console.log("Test 2: Recording explicit consent...");
    await ConsentService.recordConsent(
        lead.id,
        user.id,
        ConsentMethod.IN_PERSON_MEETING,
        "Obtained during discovery call"
    );
    console.log("✓ PASS: Consent recorded\n");

    // Test 3: Validate consent after recording (should succeed)
    console.log("Test 3: Validate consent after recording...");
    const afterRecording = await ConsentService.validateConsent(lead.id);
    if (afterRecording.hasConsent) {
        console.log("✓ PASS: Consent validated successfully\n");
    } else {
        console.error(`✗ FAIL: Consent should be valid. Reason: ${afterRecording.reason}\n`);
    }

    // Test 4: Template compliance - first message without template (should fail)
    console.log("Test 4: First message without template (should fail)...");
    const firstMessageCheck = await TemplateGuard.validateMessage(
        lead.id,
        "Hey! Check out our amazing discount!",
        false // Not a template
    );
    if (!firstMessageCheck.isValid) {
        console.log(`✓ PASS: First message requires template. Reason: ${firstMessageCheck.reason}\n`);
    } else {
        console.error("✗ FAIL: Should require template for first message\n");
    }

    // Test 5: First message WITH template (should succeed)
    console.log("Test 5: First message with approved template...");
    const templateMessage = await TemplateGuard.validateMessage(
        lead.id,
        "Hello, this is John from CraftMyFunnel. We received your inquiry and would like to schedule a call. Are you available?",
        true // Is a template
    );
    if (templateMessage.isValid) {
        console.log("✓ PASS: Template message validated\n");
        // Record it
        await TemplateGuard.recordMessageSent(lead.id, "Template message", true);
    } else {
        console.error(`✗ FAIL: Template should be valid. Reason: ${templateMessage.reason}\n`);
    }

    // Test 6: Simulate user reply (creates 24h window)
    console.log("Test 6: Simulating user reply...");
    await prisma.whatsAppMessage.create({
        data: {
            leadId: lead.id,
            body: "Yes, I'm available tomorrow",
            direction: "INBOUND",
            status: "received"
        }
    });
    console.log("✓ PASS: User reply recorded\n");

    // Test 7: Free-form message within 24h (should succeed)
    console.log("Test 7: Free-form message within 24h window...");
    const freeFormMessage = await TemplateGuard.validateMessage(
        lead.id,
        "Great! I'll send you a calendar invite.",
        false // Free-form
    );
    if (freeFormMessage.isValid) {
        console.log("✓ PASS: Free-form message allowed within 24h\n");
    } else {
        console.error(`✗ FAIL: Free-form should be allowed. Reason: ${freeFormMessage.reason}\n`);
    }

    // Test 8: Revoke consent
    console.log("Test 8: Revoking consent...");
    await ConsentService.revokeConsent(lead.id, user.id, "User opted out");
    console.log("✓ PASS: Consent revoked\n");

    // Test 9: Validate after revocation (should fail)
    console.log("Test 9: Validate after consent revocation...");
    const afterRevocation = await ConsentService.validateConsent(lead.id);
    if (!afterRevocation.hasConsent) {
        console.log(`✓ PASS: Consent correctly revoked. Reason: ${afterRevocation.reason}\n`);
    } else {
        console.error("✗ FAIL: Consent should be revoked\n");
    }

    // Test 10: Get consent history
    console.log("Test 10: Retrieving consent audit history...");
    const history = await ConsentService.getConsentHistory(lead.id);
    if (history.length >= 2) {
        console.log(`✓ PASS: Found ${history.length} audit entries (GRANTED + REVOKED)\n`);
        history.forEach((entry, idx) => {
            console.log(`  ${idx + 1}. ${entry.action} at ${entry.createdAt.toISOString()}`);
        });
    } else {
        console.error(`✗ FAIL: Expected at least 2 audit entries, found ${history.length}\n`);
    }

    console.log("\n🎉 WhatsApp Consent & Template Tests Complete!");
}

testWhatsAppConsent().catch(console.error);
