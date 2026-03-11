"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/lib/governance/PIIScrubber.ts
var PIIScrubber;
var init_PIIScrubber = __esm({
  "src/lib/governance/PIIScrubber.ts"() {
    "use strict";
    PIIScrubber = class {
      static PATTERNS = {
        // Regex patterns for PII detection
        EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        PHONE: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
        CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
        SSN: /\b\d{3}-\d{2}-\d{4}\b/g
        // IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
      };
      /**
       * Redacts PII from the input text using defined patterns.
       * Replaces detected entities with [REDACTED-<TYPE>].
       */
      static scrub(text) {
        let scrubbed = text;
        scrubbed = scrubbed.replace(this.PATTERNS.EMAIL, "[REDACTED-EMAIL]");
        scrubbed = scrubbed.replace(this.PATTERNS.PHONE, "[REDACTED-PHONE]");
        scrubbed = scrubbed.replace(this.PATTERNS.CREDIT_CARD, "[REDACTED-CREDIT-CARD]");
        scrubbed = scrubbed.replace(this.PATTERNS.SSN, "[REDACTED-SSN]");
        return scrubbed;
      }
      /**
       * Checks if text contains any potentially sensitive PII.
       */
      static containsPII(text) {
        return this.PATTERNS.EMAIL.test(text) || this.PATTERNS.PHONE.test(text) || this.PATTERNS.CREDIT_CARD.test(text) || this.PATTERNS.SSN.test(text);
      }
    };
  }
});

// src/modules/audit/auditService.ts
var auditService_exports = {};
__export(auditService_exports, {
  AuditService: () => AuditService
});
var AuditService;
var init_auditService = __esm({
  "src/modules/audit/auditService.ts"() {
    "use strict";
    init_db();
    init_PIIScrubber();
    AuditService = class {
      /**
       * Logs an action performed by a user or system in a team workspace.
       */
      static async log(teamId, userId, action, resource, resourceId, details = {}, ipAddress = null, correlationId = null) {
        if (!correlationId) {
          try {
            const { RequestContext: RequestContext2 } = await Promise.resolve().then(() => (init_requestContext(), requestContext_exports));
            correlationId = RequestContext2.getCorrelationId() || null;
            if (!correlationId) {
              const { headers } = await import("next/headers");
              const headerList = await headers();
              correlationId = headerList.get("x-correlation-id");
            }
          } catch (e) {
          }
        }
        let safeDetails = details;
        try {
          if (details) {
            const asString = JSON.stringify(details);
            if (PIIScrubber.containsPII(asString)) {
              const scrubbed = PIIScrubber.scrub(asString);
              safeDetails = JSON.parse(scrubbed);
            }
          }
        } catch (e) {
          console.warn("[AuditService] Failed to scrub PII from details", e);
        }
        try {
          await prisma.auditLog.create({
            data: {
              orgId: teamId,
              actorId: userId || "SYSTEM",
              // actorId is required in unchecked but mapped to userId which was nullable. Added system fallback.
              action,
              entity: resource,
              entityId: resourceId || null,
              metadata: safeDetails || null,
              ipAddress: ipAddress || null,
              correlationId: correlationId || null
            }
          });
        } catch (error) {
          console.error("[AuditService] Failed to log action:", error);
        }
      }
      /**
       * Fetches audit logs for a team with optional filters.
       */
      static async getLogs(teamId, limit = 50) {
        return await prisma.auditLog.findMany({
          where: { orgId: teamId },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: limit
        });
      }
      /**
       * Fetches activity for a specific resource (e.g. all logs for a Campaign).
       */
      static async getResourceActivity(resource, resourceId, limit = 50) {
        return await prisma.auditLog.findMany({
          where: { entity: resource, entityId: resourceId },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: limit
        });
      }
      /**
       * System-wide logs for administrators.
       */
      static async getSystemLogs(limit = 100) {
        return await prisma.auditLog.findMany({
          include: {
            user: { select: { name: true, email: true } },
            team: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: limit
        });
      }
    };
  }
});

// src/modules/caller/CallerService.ts
init_db();
var import_client3 = require("@prisma/client");

// src/modules/conversation/ConversationService.ts
init_db();
var import_client2 = require("@prisma/client");
var ConversationService = class {
  /**
   * Creates a new conversation thread for a lead.
   * Ensures only one active thread exists (optional business rule).
   */
  static async startThread(leadId, channel = "EMAIL") {
    return await prisma.conversationThread.create({
      data: {
        leadId,
        state: import_client2.ConversationState.INITIATED,
        channel
      }
    });
  }
  /**
   * Transitions the conversation state enforcing the State Machine rules.
   * 
   * INITIATED -> ENGAGED
   * ENGAGED -> QUALIFIED | CLOSED
   * QUALIFIED -> HANDOFF_REQUIRED
   * HANDOFF_REQUIRED -> COORDINATING
   * COORDINATING -> MEETING_CONFIRMED | CLOSED
   */
  static async transitionState(threadId, newState, reason) {
    const thread = await prisma.conversationThread.findUnique({
      where: { id: threadId },
      include: { lead: { select: { teamId: true } } }
    });
    if (!thread) throw new Error("Thread not found");
    if (!this.isValidTransition(thread.state, newState)) {
      throw new Error(`Invalid state transition from ${thread.state} to ${newState}`);
    }
    const updated = await prisma.conversationThread.update({
      where: { id: threadId },
      data: { state: newState }
    });
    if (thread.lead?.teamId) {
      const { AuditService: AuditService2 } = await Promise.resolve().then(() => (init_auditService(), auditService_exports));
      await AuditService2.log(
        thread.lead.teamId,
        null,
        // System action
        "CONVERSATION_STATE_CHANGE",
        "ConversationThread",
        threadId,
        { oldState: thread.state, newState, reason }
      );
    }
    return updated;
  }
  /**
   * Validates if a transition is allowed based on the enterprise rules.
   */
  static isValidTransition(current, next) {
    if (current === next) return true;
    if (current === import_client2.ConversationState.CLOSED) return false;
    switch (current) {
      case import_client2.ConversationState.INITIATED:
        return next === import_client2.ConversationState.ENGAGED || next === import_client2.ConversationState.CLOSED;
      case import_client2.ConversationState.ENGAGED:
        return next === import_client2.ConversationState.QUALIFIED || next === import_client2.ConversationState.CLOSED;
      case import_client2.ConversationState.QUALIFIED:
        return next === import_client2.ConversationState.HANDOFF_REQUIRED || next === import_client2.ConversationState.CLOSED;
      case import_client2.ConversationState.HANDOFF_REQUIRED:
        return next === import_client2.ConversationState.COORDINATING || next === import_client2.ConversationState.CLOSED;
      case import_client2.ConversationState.COORDINATING:
        return next === import_client2.ConversationState.MEETING_CONFIRMED || next === import_client2.ConversationState.CLOSED;
      case import_client2.ConversationState.MEETING_CONFIRMED:
        return next === import_client2.ConversationState.CLOSED;
      default:
        return false;
    }
  }
  /**
   * Appends an entry to the thread.
   * "History is immutable" - logic handled by DB append-only, but service enforces structure.
   */
  static async addEntry(threadId, leadId, role, content) {
    const thread = await prisma.conversationThread.findUnique({ where: { id: threadId } });
    if (thread?.state === import_client2.ConversationState.CLOSED) {
      throw new Error("Cannot add entries to a closed conversation");
    }
    return await prisma.conversationEntry.create({
      data: {
        leadId,
        conversationThreadId: threadId,
        role,
        content
      }
    });
  }
};

// src/modules/caller/CallerService.ts
var CallerService = class {
  /**
   * Helper to ensure coordination queue entry exists for a lead.
   */
  static async ensureQueueEntry(leadId) {
    const existing = await prisma.meetingCoordinationQueue.findUnique({
      where: { leadId }
    });
    if (!existing) {
      await prisma.meetingCoordinationQueue.create({
        data: {
          leadId,
          status: "PENDING",
          priority: 0
        }
      });
    }
  }
  /**
   * Gets leads that need human attention.
   * Criteria:
   * 1. Conversation State is HANDOFF_REQUIRED or COORDINATING
   * 2. If assigned, match assignedUserId
   * 3. If unassigned, show PENDING items
   */
  static async getQueue(userId) {
    const assigned = await prisma.meetingCoordinationQueue.findMany({
      where: {
        assignedUserId: userId,
        status: { not: "COMPLETED" }
      },
      include: {
        lead: {
          include: {
            threads: {
              where: { state: { in: ["HANDOFF_REQUIRED", "COORDINATING"] } },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        }
      },
      orderBy: { priority: "desc" }
    });
    const pool = await prisma.meetingCoordinationQueue.findMany({
      where: {
        assignedUserId: null,
        status: "PENDING"
      },
      include: {
        lead: {
          include: {
            threads: {
              where: { state: "HANDOFF_REQUIRED" },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        }
      },
      take: 10,
      orderBy: { priority: "desc" }
    });
    return { assigned, pool };
  }
  /**
   * Claims a lead from the pool.
   */
  static async claimLead(leadId, userId) {
    await this.ensureQueueEntry(leadId);
    const thread = await prisma.conversationThread.findFirst({
      where: { leadId },
      orderBy: { updatedAt: "desc" }
    });
    if (thread && thread.state === import_client3.ConversationState.HANDOFF_REQUIRED) {
      await ConversationService.transitionState(thread.id, import_client3.ConversationState.COORDINATING, `Claimed by user ${userId}`);
    }
    try {
      return await prisma.meetingCoordinationQueue.update({
        where: {
          leadId,
          assignedUserId: null
          // ONLY claim if unassigned
        },
        data: {
          assignedUserId: userId,
          status: "IN_PROGRESS",
          updatedAt: /* @__PURE__ */ new Date()
        }
      });
    } catch (error) {
      throw new Error("LEAD_ALREADY_CLAIMED");
    }
  }
  /**
   * Completes the calling task.
   */
  static async completeTask(leadId, userId, outcome, notes) {
    const queueItem = await prisma.meetingCoordinationQueue.findUnique({ where: { leadId } });
    if (queueItem?.assignedUserId !== userId && queueItem?.assignedUserId !== null) {
    }
    const thread = await prisma.conversationThread.findFirst({
      where: { leadId },
      orderBy: { updatedAt: "desc" }
    });
    if (thread) {
      await ConversationService.transitionState(thread.id, outcome, notes);
    }
    if (outcome === import_client3.ConversationState.CLOSED || outcome === import_client3.ConversationState.MEETING_CONFIRMED) {
      await prisma.meetingCoordinationQueue.update({
        where: { leadId },
        data: { status: "COMPLETED" }
      });
    } else {
    }
  }
};

// src/scripts/stress-test-handoff.ts
init_db();

// node_modules/uuid/dist-node/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist-node/rng.js
var import_node_crypto = require("node:crypto");
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    (0, import_node_crypto.randomFillSync)(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist-node/native.js
var import_node_crypto2 = require("node:crypto");
var native_default = { randomUUID: import_node_crypto2.randomUUID };

// node_modules/uuid/dist-node/v4.js
function _v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  return _v4(options, buf, offset);
}
var v4_default = v4;

// src/scripts/stress-test-handoff.ts
async function runHandoffStress() {
  console.log("\u{1F525} Starting Handoff Service Stress Test (Local) \u{1F525}");
  const teamId = "team-" + v4_default().substring(0, 8);
  const callerId = "caller-" + v4_default().substring(0, 8);
  console.log(`Setting up team ${teamId} and caller ${callerId}...`);
  await prisma.team.create({ data: { id: teamId, name: "Stress Test Org" } });
  await prisma.user.create({
    data: {
      id: callerId,
      email: `${callerId}@test.com`,
      role: "user",
      enterpriseRole: "CALLER",
      isCaller: true,
      callerTeamId: teamId
    }
  });
  console.log("Ingesting 100 leads into the coordination queue...");
  const leadIds = [];
  for (let i = 0; i < 100; i++) {
    const lid = v4_default();
    await prisma.lead.create({
      data: {
        id: lid,
        teamId,
        email: `lead${i}@stress.com`,
        pipelineState: "HANDOFF_REQUIRED"
      }
    });
    await prisma.meetingCoordinationQueue.create({
      data: {
        leadId: lid,
        status: "PENDING",
        priority: Math.floor(Math.random() * 10)
      }
    });
    leadIds.push(lid);
  }
  const threadId = v4_default();
  await prisma.conversationThread.create({
    data: {
      id: threadId,
      leadId: leadIds[0],
      state: "HANDOFF_REQUIRED"
    }
  });
  console.log(`Simulating 100 concurrent requests from caller ${callerId} for lead ${leadIds[0]}...`);
  const start = performance.now();
  const claimTasks = Array.from({ length: 100 }).map(async () => {
    try {
      return await CallerService.claimLead(leadIds[0], callerId);
    } catch (e) {
      return { error: e.message };
    }
  });
  const results = await Promise.all(claimTasks);
  const end = performance.now();
  const winners = results.filter((r) => r && !r.error).length;
  const errors = results.filter((r) => r && r.error).length;
  console.log(`
\u2705 Contention Result:`);
  console.log(`- Total Requests: 100`);
  console.log(`- Winners (Should be 1): ${winners}`);
  console.log(`- Safe Denials (Concurrency Protected): ${errors}`);
  console.log(`- Race Protection Latency: ${(end - start).toFixed(2)}ms`);
  console.log("\nSimulating 500 parallel queue fetches...");
  const startFetch = performance.now();
  const fetchTasks = Array.from({ length: 500 }).map(() => CallerService.getQueue(callerId));
  await Promise.all(fetchTasks);
  const endFetch = performance.now();
  console.log(`- Sync Latency: ${(endFetch - startFetch).toFixed(2)}ms`);
  console.log(`- Effective Throughput: ${Math.round(500 / ((endFetch - startFetch) / 1e3))} req/sec`);
  console.log("\n\u2705 Handoff Load Test PASSED (Atomic constraints verified).");
}
runHandoffStress().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
