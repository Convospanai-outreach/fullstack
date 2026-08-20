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
var import_client = require("@prisma/client");
var globalForPrisma = globalThis;
var createPrismaClient = () => {
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
var prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// check-db.ts
async function check() {
  const count = await prisma.auditLog.count();
  console.log(`Total Audit Logs: ${count}`);
  const logs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: "desc" }
  });
  logs.forEach((l) => {
    console.log(`Action: ${l.action}, CID: ${l.correlationId}, Team: ${l.orgId}`);
  });
}
check().catch(console.error).finally(() => process.exit(0));
