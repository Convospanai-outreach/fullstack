"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/requestContext.ts
var requestContext_exports = {};
__export(requestContext_exports, {
  RequestContext: () => RequestContext
});
var import_node_async_hooks, RequestContext;
var init_requestContext = __esm({
  "src/lib/requestContext.ts"() {
    "use strict";
    import_node_async_hooks = require("node:async_hooks");
    RequestContext = class {
      static storage = new import_node_async_hooks.AsyncLocalStorage();
      static run(data, fn) {
        return this.storage.run(data, fn);
      }
      static get() {
        return this.storage.getStore();
      }
      static getCorrelationId() {
        return this.storage.getStore()?.correlationId;
      }
    };
  }
});

// src/lib/db.ts
var import_client, globalForPrisma, createPrismaClient, prisma;
var init_db = __esm({
  "src/lib/db.ts"() {
    "use strict";
    import_client = require("@prisma/client");
    globalForPrisma = globalThis;
    createPrismaClient = () => {
      const client = new import_client.PrismaClient({
        log: ["error"]
      }).$extends({
        query: {
          $allOperations({ model, operation, args, query }) {
            try {
              const { RequestContext: RequestContext2 } = (init_requestContext(), __toCommonJS(requestContext_exports));
              const correlationId = RequestContext2.getCorrelationId();
              if (correlationId) {
              }
            } catch (e) {
            }
            return query(args);
          },
          message: {
            async create({ args, query }) {
              const data = args.data;
              const hasThreadId = "conversationThreadId" in data && data.conversationThreadId;
              const hasThreadConnect = "thread" in data && data.thread;
              if (!hasThreadId && !hasThreadConnect) {
                throw new Error("Invariant Violation: Message must belong to a ConversationThread.");
              }
              return query(args);
            }
          }
        }
      });
      return client;
    };
    prisma = globalForPrisma.prisma ?? createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prisma;
    }
  }
});

// src/lib/queue.ts
var JobQueue;
var init_queue = __esm({
  "src/lib/queue.ts"() {
    "use strict";
    init_db();
    JobQueue = class {
      /**
       * Enqueue a new job
       */
      static async enqueue(type, payload, options = {}) {
        if (options.idempotencyKey) {
          const existingJob = await prisma.job.findUnique({
            where: { idempotencyKey: options.idempotencyKey }
          });
          if (existingJob) return existingJob;
        }
        const data = {
          type,
          payload: { ...payload },
          // Clone to avoid mutation
          priority: options.priority ?? 0,
          processAt: options.processAt ?? /* @__PURE__ */ new Date(),
          teamId: options.teamId ?? null,
          status: "pending"
        };
        if (!data.payload.correlationId) {
          try {
            const { RequestContext: RequestContext2 } = await Promise.resolve().then(() => (init_requestContext(), requestContext_exports));
            const cid = RequestContext2.getCorrelationId();
            if (cid) {
              data.payload.correlationId = cid;
            }
          } catch (e) {
          }
        }
        if (options.idempotencyKey) {
          data.idempotencyKey = options.idempotencyKey;
        }
        return await prisma.job.create({ data });
      }
      /**
       * Dequeue the next available job
       * Uses a transaction to lock the job row
       */
      static async dequeue() {
        const now = /* @__PURE__ */ new Date();
        const candidates = await prisma.job.findMany({
          where: {
            status: "pending",
            processAt: { lte: now }
          },
          orderBy: [
            { priority: "desc" },
            { processAt: "asc" }
          ],
          take: 5
        });
        for (const candidate of candidates) {
          try {
            const claimed = await prisma.job.update({
              where: {
                id: candidate.id,
                status: "pending"
                // Optimistic locking
              },
              data: {
                status: "processing",
                startedAt: /* @__PURE__ */ new Date(),
                attempts: { increment: 1 }
              }
            });
            return claimed;
          } catch (err) {
            continue;
          }
        }
        return null;
      }
      /**
       * Mark job as completed
       */
      static async complete(jobId, result) {
        return await prisma.job.update({
          where: { id: jobId },
          data: {
            status: "completed",
            completedAt: /* @__PURE__ */ new Date(),
            result: result || {}
          }
        });
      }
      /**
       * Mark job as failed. Retry if attempts < maxAttempts.
       */
      static async fail(jobId, error) {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) return;
        const isRetryable = job.attempts < job.maxAttempts;
        if (isRetryable) {
          const backoffSeconds = Math.pow(2, job.attempts) * 30;
          const nextProcessAt = new Date(Date.now() + backoffSeconds * 1e3);
          return await prisma.job.update({
            where: { id: jobId },
            data: {
              status: "pending",
              // Reset to pending for retry
              error,
              processAt: nextProcessAt
            }
          });
        } else {
          return await prisma.job.update({
            where: { id: jobId },
            data: {
              status: "dead_letter",
              completedAt: /* @__PURE__ */ new Date(),
              error
            }
          });
        }
      }
      /**
       * Resets jobs stuck in 'processing' for too long.
       * This protects against worker crashes.
       */
      static async resetStaleJobs(maxAgeMs = 1e3 * 60 * 15) {
        const threshold = new Date(Date.now() - maxAgeMs);
        const staleJobs = await prisma.job.findMany({
          where: {
            status: "processing",
            startedAt: { lte: threshold }
          }
        });
        if (staleJobs.length === 0) return 0;
        console.log(`[JobQueue] Resetting ${staleJobs.length} stale jobs to pending.`);
        const result = await prisma.job.updateMany({
          where: {
            id: { in: staleJobs.map((j) => j.id) }
          },
          data: {
            status: "pending",
            error: "Stale job reset by watchdog."
          }
        });
        return result.count;
      }
    };
  }
});

// src/modules/learning/EventStore.ts
var EventStore_exports = {};
__export(EventStore_exports, {
  EventStore: () => EventStore,
  SystemEventType: () => SystemEventType
});
var SystemEventType, EventStore;
var init_EventStore = __esm({
  "src/modules/learning/EventStore.ts"() {
    "use strict";
    init_db();
    init_queue();
    SystemEventType = /* @__PURE__ */ ((SystemEventType2) => {
      SystemEventType2["USER"] = "USER";
      SystemEventType2["AI"] = "AI";
      SystemEventType2["ESP"] = "ESP";
      SystemEventType2["SYSTEM"] = "SYSTEM";
      SystemEventType2["AGENT"] = "AGENT";
      return SystemEventType2;
    })(SystemEventType || {});
    EventStore = class {
      /**
       * Records an immutable event and triggers side-effects (Task 2)
       */
      static async record(params) {
        const event = await prisma.systemEvent.create({
          data: {
            type: params.type,
            name: params.name,
            teamId: params.teamId,
            actorId: params.actorId || "SYSTEM",
            payload: params.payload
          }
        });
        await JobQueue.enqueue("event_processing", {
          eventId: event.id,
          teamId: event.teamId
        });
        return event;
      }
      /**
       * Entry point for background worker to process event side-effects.
       */
      static async processEventJob(eventId) {
        const event = await prisma.systemEvent.findUnique({ where: { id: eventId } });
        if (!event) return;
        if (["REPLY_RECEIVED", "CLICK", "BOUNCE"].includes(event.name)) {
          await this.processOutcomeForRAG(event);
        }
        await this.generateAuditNarrative(event);
      }
      /**
       * Task 1: Re-weight KnowledgeItems based on outcome signals
       */
      static async processOutcomeForRAG(event) {
        const { knowledgeItemId } = event.payload;
        if (!knowledgeItemId) return;
        const weights = {
          "REPLY_RECEIVED": 1,
          "CLICK": 0.3,
          "BOUNCE": -1
        };
        const reward = weights[event.name] || 0.1;
        await prisma.knowledgePerformance.upsert({
          where: { knowledgeItemId },
          update: {
            rewardScore: { increment: reward },
            usageCount: { increment: 1 },
            replies: { increment: event.name === "REPLY_RECEIVED" ? 1 : 0 },
            clicks: { increment: event.name === "CLICK" ? 1 : 0 },
            bounces: { increment: event.name === "BOUNCE" ? 1 : 0 },
            ...reward > 0 ? { lastSuccessAt: /* @__PURE__ */ new Date() } : {}
          },
          create: {
            knowledgeItemId,
            rewardScore: reward,
            usageCount: 1,
            replies: event.name === "REPLY_RECEIVED" ? 1 : 0,
            clicks: event.name === "CLICK" ? 1 : 0,
            bounces: event.name === "BOUNCE" ? 1 : 0,
            lastSuccessAt: reward > 0 ? /* @__PURE__ */ new Date() : null
          }
        });
      }
      /**
       * Task 7: Human-readable Audit Narratives
       */
      static async generateAuditNarrative(event) {
        let narrative = `Event ${event.name} recorded at ${event.timestamp.toISOString()}.`;
        switch (event.name) {
          case "DRAFT_SENT":
          case "DRAFT_GENERATED":
            narrative = `AI generated a outreach draft for lead ${event.payload.leadName}.`;
            break;
          case "LEAD_INGESTED":
            narrative = `Ingested lead ${event.payload.leadEmail} from source ${event.payload.source}.`;
            break;
          case "FEEDBACK_RECEIVED":
            narrative = `User provided feedback (${event.payload.feedbackType}) on generation ${event.payload.generationId}.`;
            break;
          case "ACTION_APPROVED":
            narrative = `Human reviewer approved the automated outreach plan for ${event.payload.entityType}.`;
            break;
          case "REPLY_RECEIVED":
            narrative = `Successful conversion! Received a reply from ${event.payload.leadEmail}.`;
            break;
          // Agent-specific events
          case "AGENT_STATE_TRANSITION":
            narrative = `Agent task ${event.payload.taskId} transitioned from ${event.payload.fromState} to ${event.payload.toState}.`;
            break;
          case "AGENT_TOOL_EXECUTION":
            narrative = `Agent executed tool '${event.payload.toolName}' ${event.payload.success ? "successfully" : "with error: " + event.payload.error}.`;
            break;
          case "AGENT_APPROVAL_REQUESTED":
            narrative = `Agent task ${event.payload.taskId} requested approval for ${event.payload.actionType} (Risk: ${event.payload.riskLevel}).`;
            break;
          case "AGENT_APPROVAL_GRANTED":
            narrative = `Approval granted for agent task ${event.payload.taskId} by ${event.payload.approverId}.`;
            break;
          case "AGENT_APPROVAL_REJECTED":
            narrative = `Approval rejected for agent task ${event.payload.taskId} by ${event.payload.approverId}. Reason: ${event.payload.reason || "N/A"}.`;
            break;
          case "AGENT_TASK_COMPLETED":
            narrative = `Agent task ${event.payload.taskId} completed ${event.payload.success ? "successfully" : "with failure"}.`;
            break;
        }
        const hash = "hash_" + event.id.substring(0, 8);
        await prisma.immutableAudit.create({
          data: {
            eventId: event.id,
            teamId: event.teamId,
            narrative,
            hash
          }
        });
      }
    };
  }
});

// src/modules/contract/contractResolver.ts
init_db();
var ContractResolver = class {
  /**
   * Resolves the active contract for a team and verifies access to a capability.
   * Throws strictly if access is denied.
   */
  static async resolveOrThrow(teamId, requiredCapability, channel) {
    const profile = await prisma.contractProfile.findUnique({
      where: { teamId }
    });
    if (!profile) {
      console.warn(`[ContractResolver] No profile found for team ${teamId}. Blocking execution.`);
      throw new Error("CONTRACT_MISSING_PROFILE");
    }
    if (profile.contractStatus === "TERMINATED" || profile.contractStatus === "SUSPENDED") {
      await this.logDenial(teamId, "STATUS_CHECK", `Contract status is ${profile.contractStatus}`);
      throw new Error(`CONTRACT_STATUS_${profile.contractStatus}`);
    }
    const layer = String(requiredCapability);
    if (!profile.allowedCapabilityLayers.includes(layer) && !profile.allowedCapabilityLayers.includes("ALL_FEATURES")) {
      await this.logDenial(teamId, "CAPABILITY_CHECK", `Missing layer: ${layer}`);
      throw new Error(`CONTRACT_CAPABILITY_DENIED: ${layer}`);
    }
    if (channel) {
      if (!profile.allowedChannels.includes(channel)) {
        await this.logDenial(teamId, "CHANNEL_CHECK", `Channel denied: ${channel}`);
        throw new Error(`CONTRACT_CHANNEL_DENIED: ${channel}`);
      }
    }
    return profile;
  }
  static async logDenial(teamId, checkType, reason) {
    const { EventStore: EventStore2, SystemEventType: SystemEventType2 } = await Promise.resolve().then(() => (init_EventStore(), EventStore_exports));
    await EventStore2.record({
      type: SystemEventType2.SYSTEM,
      name: "CONTRACT_DENIAL",
      teamId,
      payload: {
        checkType,
        reason,
        timestamp: /* @__PURE__ */ new Date()
      }
    });
  }
  static async getLimits(teamId) {
    const profile = await prisma.contractProfile.findUnique({
      where: { teamId }
    });
    return {
      aiLimit: profile?.aiUsageLimit || 0,
      threadLimit: profile?.conversationThreadLimit || 0,
      handoffLimit: profile?.humanHandoffLimit || 0
    };
  }
};

// src/modules/contract/killSwitch.ts
init_db();
init_EventStore();
var KillSwitch = class {
  /**
   * Checks if a specific capability is killed at the Org level.
   * Logs every check failure to audit trail.
   */
  static async verifyOrDie(teamId, type = "ALL") {
    const profile = await prisma.contractProfile.findUnique({
      where: { teamId }
    });
    if (!profile) {
      await this.logKill(teamId, type, "MISSING_PROFILE");
      throw new Error("KILL_SWITCH_ENGAGED: PROFILE_MISSING");
    }
    if (profile.contractStatus === "TERMINATED") {
      await this.logKill(teamId, type, "CONTRACT_TERMINATED");
      throw new Error("KILL_SWITCH_ENGAGED: CONTRACT_TERMINATED");
    }
    if (profile.contractStatus === "SUSPENDED") {
      await this.logKill(teamId, type, "CONTRACT_SUSPENDED");
      throw new Error("KILL_SWITCH_ENGAGED: CONTRACT_SUSPENDED");
    }
    if (type === "AI") {
      if (!profile.allowedCapabilityLayers.includes("GOVERNED_AI") && !profile.allowedCapabilityLayers.includes("ALL_FEATURES")) {
        await this.logKill(teamId, type, "AI_DISABLED_IN_CONTRACT");
        throw new Error("KILL_SWITCH_ENGAGED: AI_DISABLED");
      }
    }
  }
  static async logKill(teamId, type, reason) {
    await EventStore.record({
      type: "SYSTEM" /* SYSTEM */,
      name: "KILL_SWITCH_TRIGGERED",
      teamId,
      payload: {
        targetType: type,
        reason,
        timestamp: /* @__PURE__ */ new Date()
      }
    });
  }
};

// src/scripts/load-test-observability.ts
init_db();
var CONCURRENT_USERS = 50;
var ACTIONS_PER_USER = 10;
async function main() {
  console.log(`\u{1F680} Starting Load Test: ${CONCURRENT_USERS} users x ${ACTIONS_PER_USER} actions`);
  console.log("Creating test teams...");
  const teams = [];
  for (let i = 0; i < 30; i++) {
    const team = await prisma.team.create({ data: { name: `LoadTest Team ${i}` } });
    teams.push(team);
    let status = "ACTIVE";
    let channel = ["EMAIL"];
    if (i >= 10 && i < 20) status = "SUSPENDED";
    if (i >= 20) {
      channel = [];
    }
    await prisma.contractProfile.create({
      data: {
        teamId: team.id,
        contractStatus: status,
        allowedChannels: channel,
        allowedCapabilityLayers: ["CORE"],
        // Missing GOVERNED_AI
        aiUsageLimit: 1e3
      }
    });
  }
  let totalDenials = 0;
  let totalSuccess = 0;
  const start = Date.now();
  const tasks = teams.map(async (team) => {
    for (let j = 0; j < ACTIONS_PER_USER; j++) {
      try {
        if (Math.random() > 0.5) {
          await ContractResolver.resolveOrThrow(team.id, "GOVERNED_AI");
        } else {
          await ContractResolver.resolveOrThrow(team.id, "ADVANCED_OPS", "LINKEDIN");
        }
        totalSuccess++;
      } catch (e) {
        totalDenials++;
      }
      if (Math.random() > 0.9) {
        try {
          await KillSwitch.verifyOrDie(team.id, "ALL");
        } catch (e) {
        }
      }
    }
  });
  await Promise.all(tasks);
  const duration = (Date.now() - start) / 1e3;
  console.log(`
\u2705 Load Test Complete in ${duration}s`);
  console.log(`Throughput: ${30 * ACTIONS_PER_USER / duration} ops/sec`);
  console.log(`Total Denials Logged: ${totalDenials}`);
  console.log(`Total Success: ${totalSuccess}`);
  console.log("Cleaning up...");
  for (const t of teams) {
    await prisma.contractProfile.delete({ where: { teamId: t.id } });
    await prisma.team.delete({ where: { id: t.id } });
  }
}
main();
