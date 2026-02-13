# Scalability Audit Report (10x Goal)

## Executive Summary
The current architecture is optimized for low-volume, high-quality agency work but contains several "Synchronous Chokepoints" that will cause system failure at 10x current load (e.g., 10,000+ lead ingestions or 1,000+ concurrent agent tasks).

## 🚨 Critical Bottlenecks

### 1. Ingestion Serial Loop
- **File**: `DataIngestionService.ts`
- **Issue**: Leads are processed one-by-one in a `for` loop. Each lead triggers:
  - 1 DB lookup
  - 1 DB write
  - 1 AI Generation call (Blocking!)
  - 1 EventStore write
- **Impact**: Uploading a 500-row CSV will likely time out the request or take ~5-10 minutes.

### 2. Synchronous Event Side-Effects
- **File**: `EventStore.ts`
- **Issue**: `EventStore.record()` performs multiple DB writes (`ImmutableAudit`, `KnowledgePerformance`) synchronously.
- **Impact**: Any "Event" (Reply, Click, Ingestion) slows down the main execution thread of the agent.

### 3. Agent Log Bloat
- **File**: `AgentLog` table in `schema.prisma`
- **Issue**: Agents log frequently (Thought, Observation, etc.). Lack of table partitioning or TTL for logs will cause the `AgentLog` table to grow exponentially, eventually slowing down all agent queries.

## 🛠️ Remediation Roadmap

### Immediate Fixes (Next Steps)
- [ ] **Background Generations**: Move `triggerInitialGeneration` call into the `JobQueue`.
- [ ] **Bulk Upsert**: Refactor lead ingestion to use `prisma.createMany` for raw data, then trigger enrichment jobs.
- [ ] **Async Event Processing**: Use an Event Bus (e.g., EventEmitter or Redis Pub/Sub) to handle audit logging and RAG re-weighting outward of the main event recording.

### Architectural Recommendations
- **Postgres Partitioning**: Partition `EventStore` and `AgentLog` by `teamId` or `month`.
- **Read Replicas**: Offload dashboard/analytics queries to a read-only DB instance.

## 🚀 Load Testing Strategy
I have prepared a `k6` script template to simulate:
1. 1,000 Concurrent Lead Ingestions
2. 500 Concurrent Agent State Transitions
3. High-volume PII masking/unmasking throughput
