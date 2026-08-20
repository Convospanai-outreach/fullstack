"use strict";

// src/lib/ai/HybridRouter.ts
var import_client = require("@prisma/client");
var HybridRouter = class {
  /**
   * Core routing logic: Determines if task should run on Cloud or On-Prem
   */
  static async route(context) {
    const isEdgeHealthy = await this.checkEdgeNodeHealth();
    if (context.productMode === import_client.ProductMode.ENTERPRISE_CORE && context.isComplianceSensitive) {
      if (!isEdgeHealthy) throw new Error("Sovereign Node Offline: Cannot process compliance-sensitive task.");
      return { destination: "ON_PREM" /* ON_PREM */, model: "phi-3-mini" };
    }
    if (context.containsPII) {
      if (!isEdgeHealthy) throw new Error("Sovereign Node Offline: PII detected, blocking cloud egress.");
      return { destination: "ON_PREM" /* ON_PREM */, model: "phi-3-mini" };
    }
    if (context.requiresResidentialIP) {
      if (!isEdgeHealthy) throw new Error("Sovereign Node Offline: Physical node required for automation.");
      return { destination: "ON_PREM" /* ON_PREM */, model: "phi-3-mini" };
    }
    const preferredOnPrem = [
      "LINKEDIN_MESSAGE" /* LINKEDIN_MESSAGE */,
      "SCRAPING" /* SCRAPING */,
      "AUTOMATION" /* AUTOMATION */
    ];
    if (preferredOnPrem.includes(context.taskType)) {
      if (isEdgeHealthy) {
        return { destination: "ON_PREM" /* ON_PREM */, model: "phi-3-mini" };
      }
      return { destination: "CLOUD" /* CLOUD */, model: "gemini-1.5-flash" };
    }
    return {
      destination: "CLOUD" /* CLOUD */,
      model: context.taskType === "EMAIL_DRAFT" /* EMAIL_DRAFT */ ? "gemini-1.5-pro" : "gemini-1.5-flash"
    };
  }
  static async checkEdgeNodeHealth() {
    const endpoint = this.getEndpoint("ON_PREM" /* ON_PREM */);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1e3);
      const res = await fetch(`${endpoint}/health`, { signal: controller.signal });
      clearTimeout(id);
      return res.ok;
    } catch (e) {
      return false;
    }
  }
  /**
   * Helper to get the appropriate endpoint based on destination
   */
  static getEndpoint(destination) {
    if (destination === "ON_PREM" /* ON_PREM */) {
      return process.env["ON_PREM_AI_ENDPOINT"] || process.env["EDGE_NODE_URI"] || "http://localhost:8000";
    }
    return "CLOUD";
  }
  /**
   * Validate that no PII is being sent to cloud
   */
  static validateCloudSafety(destination, prompt) {
    if (destination === "CLOUD" /* CLOUD */) {
      const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/,
        // SSN
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
        // Email
        /\b\d{10}\b/,
        // Phone (basic)
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/
        // Credit card
      ];
      for (const pattern of piiPatterns) {
        if (pattern.test(prompt)) {
          throw new Error("PII detected in cloud-bound request. Routing violation.");
        }
      }
    }
  }
};

// load-test-router.ts
async function testRouterLoad() {
  const CONCURRENT_REQUESTS = 500;
  console.log(`\u{1F680} Starting AI Router Load Test: ${CONCURRENT_REQUESTS} concurrent requests`);
  const start = performance.now();
  const tasks = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, i) => {
    const containsPII = i % 2 === 0;
    const taskType = i % 3 === 0 ? "EMAIL_DRAFT" /* EMAIL_DRAFT */ : "SUMMARY" /* SUMMARY */;
    try {
      const result = await HybridRouter.route({
        taskType,
        containsPII,
        productMode: "ENTERPRISE_CORE",
        isComplianceSensitive: true
      });
      return { success: true, destination: result.destination };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  const results = await Promise.all(tasks);
  const end = performance.now();
  const duration = (end - start) / 1e3;
  const success = results.filter((r) => r.success).length;
  const failures = results.filter((r) => !r.success).length;
  const blockedPII = results.filter((r) => !r.success && r.error?.includes("Sovereign Node Offline")).length;
  console.log(`
\u2705 Finished in ${duration.toFixed(3)}s`);
  console.log(`Throughput: ${(CONCURRENT_REQUESTS / duration).toFixed(2)} req/sec`);
  console.log(`Successful Routes: ${success}`);
  console.log(`Blocked (Safe-Closed) PII: ${blockedPII}`);
  console.log(`Other Failures: ${failures - blockedPII}`);
}
testRouterLoad().catch(console.error).finally(() => process.exit(0));
