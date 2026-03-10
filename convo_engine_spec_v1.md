# ConvoSpan Autonomous Engine — Production Specification v1.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Agent Contracts](#3-agent-contracts)
4. [State Machine](#4-state-machine)
5. [API Routes](#5-api-routes)
6. [Task Queue Structure](#6-task-queue-structure)
7. [Deployment Notes](#7-deployment-notes)

---

## 1. System Overview

### 1.1 Identity

| Field            | Value                                                                 |
|------------------|-----------------------------------------------------------------------|
| **System Name**  | ConvoSpan Autonomous Engine                                           |
| **Version**      | 1.0.0                                                                 |
| **Runtime**      | Python 3.11 (with 'uv'), PostgreSQL 16, Redis 7.2, Gemini 2.0 Flash (cloud), Micro-LLM (edge) |
| **Architecture** | Hybrid Edge-Cloud                                                     |
| **Data Policy**  | PII never leaves sovereign firewall boundary                          |

### 1.2 Industry Verticals

```
manufacturing | healthcare | facility_management | bfsi | ites | pharma | security
```

### 1.3 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     SOVEREIGN FIREWALL                           │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Edge Node   │   │  Micro-LLM   │   │  PostgreSQL (PII DB) │ │
│  │  (On-Prem)   │──▶│  Tagger      │   │  Row-Level Security  │ │
│  └──────┬───────┘   └──────────────┘   └──────────────────────┘ │
│         │                                                        │
│  ┌──────▼───────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Redis Queue │──▶│  Agent Orch. │──▶│  Anonymizer Service  │ │
│  │  (Task Bus)  │   │  (Python)    │   │  (PII Scrub Layer)   │ │
│  └──────────────┘   └──────┬───────┘   └──────────────────────┘ │
│                             │                                     │
└─────────────────────────────┼───────────────────────────────────┘
                              │ Anonymized payloads only
                    ┌─────────▼──────────┐
                    │   Gemini 2.0 Flash │
                    │   (Cloud LLM)      │
                    │   google.cloud.ai  │
                    └────────────────────┘
```

### 1.4 Core Principles

- **Model-Agnostic**: Agent contracts bind to capability interfaces, not model implementations.
- **PII Sovereignty**: PII extraction, storage, and processing occur exclusively within the firewall. Only anonymized, tokenized payloads reach cloud LLMs.
- **Hybrid Execution**: Micro-LLM handles classification, tagging, and routing on-prem; Gemini handles reasoning, generation, and synthesis in cloud.
- **Fault-Tolerant**: All agent tasks are idempotent with at-least-once delivery semantics via Redis queues.
- **Vertical-Aware**: Industry context is injected at task dispatch time via vertical policy manifests.

---

## 2. Database Schema

### 2.1 PostgreSQL — DDL

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE industry_vertical AS ENUM (
    'manufacturing', 'healthcare', 'facility_management',
    'bfsi', 'ites', 'pharma', 'security'
);

CREATE TYPE agent_status AS ENUM (
    'idle', 'queued', 'running', 'paused', 'completed',
    'failed', 'retrying', 'cancelled'
);

CREATE TYPE task_priority AS ENUM ('critical', 'high', 'normal', 'low');

CREATE TYPE pii_classification AS ENUM (
    'none', 'restricted', 'confidential', 'top_secret'
);

CREATE TYPE llm_tier AS ENUM ('edge_micro', 'cloud_gemini', 'hybrid');

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    vertical        industry_vertical NOT NULL,
    firewall_zone   TEXT NOT NULL,
    policy_manifest JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AGENTS
-- ============================================================
CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    capability_tags TEXT[] NOT NULL DEFAULT '{}',
    llm_tier        llm_tier NOT NULL DEFAULT 'hybrid',
    system_prompt   TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    status          agent_status NOT NULL DEFAULT 'idle',
    last_heartbeat  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_tenant_id ON agents(tenant_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_capability_tags ON agents USING GIN(capability_tags);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id),
    parent_task_id  UUID REFERENCES tasks(id),
    title           TEXT NOT NULL,
    description     TEXT,
    task_type       TEXT NOT NULL,
    priority        task_priority NOT NULL DEFAULT 'normal',
    status          agent_status NOT NULL DEFAULT 'queued',
    pii_class       pii_classification NOT NULL DEFAULT 'none',
    input_payload   JSONB NOT NULL DEFAULT '{}',
    output_payload  JSONB,
    error_detail    TEXT,
    retry_count     SMALLINT NOT NULL DEFAULT 0,
    max_retries     SMALLINT NOT NULL DEFAULT 3,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- ============================================================
-- CONVERSATIONS (PII-SENSITIVE — stays on-prem)
-- ============================================================
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id),
    session_token   TEXT NOT NULL UNIQUE,
    pii_class       pii_classification NOT NULL DEFAULT 'restricted',
    raw_transcript  TEXT,                         -- encrypted at rest
    anon_transcript TEXT,                         -- PII-scrubbed version
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_task_id ON conversations(task_id);

-- ============================================================
-- AUDIT LOG (immutable append-only)
-- ============================================================
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    actor_id        UUID,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL,
    diff            JSONB,
    ip_address      INET,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at);

-- ============================================================
-- PII VAULT (sovereign storage — no cloud egress)
-- ============================================================
CREATE TABLE pii_vault (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,         -- stable anonymization token
    field_type      TEXT NOT NULL,                -- e.g. 'name', 'email', 'mrn'
    encrypted_value BYTEA NOT NULL,               -- AES-256-GCM
    hash_value      TEXT NOT NULL,                -- SHA-256 for lookup
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pii_vault_tenant_id ON pii_vault(tenant_id);
CREATE INDEX idx_pii_vault_token ON pii_vault(token);
CREATE INDEX idx_pii_vault_hash ON pii_vault(hash_value);

-- ============================================================
-- VERTICAL POLICIES
-- ============================================================
CREATE TABLE vertical_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical        industry_vertical NOT NULL UNIQUE,
    compliance_tags TEXT[] NOT NULL DEFAULT '{}',
    data_retention_days INT NOT NULL DEFAULT 365,
    allowed_llm_tiers   llm_tier[] NOT NULL DEFAULT '{hybrid}',
    pii_fields      TEXT[] NOT NULL DEFAULT '{}',
    policy_doc      JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Agent Contracts

### 3.1 Base Agent Interface Contract

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "convospan:agent:base:v1",
  "title": "BaseAgentContract",
  "type": "object",
  "required": ["agent_id", "capabilities", "llm_tier", "input_schema", "output_schema"],
  "properties": {
    "agent_id": {
      "type": "string",
      "format": "uuid",
      "description": "Globally unique agent identifier"
    },
    "name": {
      "type": "string",
      "description": "Human-readable agent name"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "capabilities": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Semantic capability tags used for routing"
    },
    "llm_tier": {
      "type": "string",
      "enum": ["edge_micro", "cloud_gemini", "hybrid"]
    },
    "pii_handling": {
      "type": "string",
      "enum": ["none", "anonymize_before_llm", "reject_if_pii"]
    },
    "input_schema": {
      "type": "object",
      "description": "JSON Schema defining required task inputs"
    },
    "output_schema": {
      "type": "object",
      "description": "JSON Schema defining guaranteed task outputs"
    },
    "timeout_seconds": {
      "type": "integer",
      "minimum": 1,
      "maximum": 3600,
      "default": 300
    },
    "max_retries": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10,
      "default": 3
    },
    "vertical_constraints": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "manufacturing", "healthcare", "facility_management",
          "bfsi", "ites", "pharma", "security"
        ]
      },
      "description": "Empty array means unrestricted across all verticals"
    }
  }
}
```

### 3.2 Task Dispatch Contract

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "convospan:task:dispatch:v1",
  "title": "TaskDispatchContract",
  "type": "object",
  "required": ["task_id", "tenant_id", "task_type", "priority", "payload"],
  "properties": {
    "task_id": { "type": "string", "format": "uuid" },
    "tenant_id": { "type": "string", "format": "uuid" },
    "parent_task_id": { "type": "string", "format": "uuid" },
    "task_type": {
      "type": "string",
      "description": "Semantic type matched against agent capability_tags"
    },
    "priority": {
      "type": "string",
      "enum": ["critical", "high", "normal", "low"],
      "default": "normal"
    },
    "vertical": {
      "type": "string",
      "enum": [
        "manufacturing", "healthcare", "facility_management",
        "bfsi", "ites", "pharma", "security"
      ]
    },
    "pii_class": {
      "type": "string",
      "enum": ["none", "restricted", "confidential", "top_secret"],
      "default": "none"
    },
    "payload": {
      "type": "object",
      "description": "Agent-specific input data (PII already anonymized)"
    },
    "context": {
      "type": "object",
      "properties": {
        "conversation_id": { "type": "string", "format": "uuid" },
        "session_token": { "type": "string" },
        "user_locale": { "type": "string" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "deadline_utc": {
      "type": "string",
      "format": "date-time",
      "description": "Hard deadline; task is cancelled if not completed by this time"
    },
    "idempotency_key": {
      "type": "string",
      "description": "Caller-supplied key to prevent duplicate task creation"
    }
  }
}
```

### 3.3 Task Result Contract

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "convospan:task:result:v1",
  "title": "TaskResultContract",
  "type": "object",
  "required": ["task_id", "agent_id", "status", "completed_at"],
  "properties": {
    "task_id": { "type": "string", "format": "uuid" },
    "agent_id": { "type": "string", "format": "uuid" },
    "status": {
      "type": "string",
      "enum": ["completed", "failed", "cancelled"]
    },
    "output": {
      "type": "object",
      "description": "Structured result payload"
    },
    "error": {
      "type": "object",
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" },
        "retryable": { "type": "boolean" },
        "trace_id": { "type": "string" }
      }
    },
    "llm_usage": {
      "type": "object",
      "properties": {
        "model": { "type": "string" },
        "input_tokens": { "type": "integer" },
        "output_tokens": { "type": "integer" },
        "latency_ms": { "type": "integer" }
      }
    },
    "pii_tokens_used": {
      "type": "array",
      "items": { "type": "string" },
      "description": "PII vault tokens referenced during task (never includes raw PII)"
    },
    "completed_at": { "type": "string", "format": "date-time" },
    "duration_ms": { "type": "integer" }
  }
}
```

### 3.4 Built-in Agent Manifest

```json
{
  "agents": [
    {
      "name": "IntentClassifierAgent",
      "capabilities": ["intent_classification", "utterance_tagging"],
      "llm_tier": "edge_micro",
      "pii_handling": "reject_if_pii",
      "vertical_constraints": []
    },
    {
      "name": "PIIExtractorAgent",
      "capabilities": ["pii_detection", "pii_tokenization"],
      "llm_tier": "edge_micro",
      "pii_handling": "anonymize_before_llm",
      "vertical_constraints": ["healthcare", "bfsi", "pharma"]
    },
    {
      "name": "WorkflowOrchestratorAgent",
      "capabilities": ["workflow_routing", "task_decomposition", "subtask_dispatch"],
      "llm_tier": "hybrid",
      "pii_handling": "anonymize_before_llm",
      "vertical_constraints": []
    },
    {
      "name": "GeminiReasoningAgent",
      "capabilities": ["complex_reasoning", "report_generation", "summarization"],
      "llm_tier": "cloud_gemini",
      "pii_handling": "anonymize_before_llm",
      "vertical_constraints": []
    },
    {
      "name": "ComplianceGuardAgent",
      "capabilities": ["compliance_check", "policy_enforcement", "audit_trail"],
      "llm_tier": "edge_micro",
      "pii_handling": "reject_if_pii",
      "vertical_constraints": ["healthcare", "bfsi", "pharma", "security"]
    },
    {
      "name": "SentinelFirewallAgent",
      "capabilities": ["egress_inspection", "pii_redaction", "data_loss_prevention"],
      "llm_tier": "edge_micro",
      "pii_handling": "reject_if_pii",
      "vertical_constraints": []
    },
    {
      "name": "FacilityInsightAgent",
      "capabilities": ["sensor_analysis", "maintenance_prediction", "incident_routing"],
      "llm_tier": "hybrid",
      "pii_handling": "none",
      "vertical_constraints": ["facility_management", "manufacturing"]
    },
    {
      "name": "HealthcareSummaryAgent",
      "capabilities": ["clinical_summary", "ehr_extraction", "medication_review"],
      "llm_tier": "hybrid",
      "pii_handling": "anonymize_before_llm",
      "vertical_constraints": ["healthcare", "pharma"]
    }
  ]
}
```

---

## 4. State Machine

### 4.1 Task Lifecycle States

```
                     ┌──────────────────────────────────────┐
                     │                                      │
                   QUEUED ──────────► RUNNING ──────────► COMPLETED
                     │                  │
                     │                  ├──────────► FAILED ──► RETRYING ──┐
                     │                  │                                   │
                     │                  └──────────► PAUSED                 │
                     │                                                      │
                     └──────────────────────────────────────────────────────┘
                     │
                     └──► CANCELLED (at any non-terminal state)
```

### 4.2 State Transition Table

| From State   | Event                    | To State    | Side Effect                                      |
|--------------|--------------------------|-------------|--------------------------------------------------|
| `queued`     | agent claims task        | `running`   | Set `started_at`; emit `task.started` event      |
| `queued`     | deadline exceeded        | `cancelled` | Emit `task.deadline_exceeded` event              |
| `queued`     | operator cancel          | `cancelled` | Emit `task.cancelled` event                      |
| `running`    | task completes           | `completed` | Write `output_payload`; emit `task.completed`    |
| `running`    | non-retryable error      | `failed`    | Write `error_detail`; emit `task.failed`         |
| `running`    | retryable error          | `retrying`  | Increment `retry_count`; schedule backoff        |
| `running`    | pause signal received    | `paused`    | Checkpoint state to Redis                        |
| `running`    | operator cancel          | `cancelled` | Interrupt agent; emit `task.cancelled`           |
| `retrying`   | backoff elapsed          | `queued`    | Re-enqueue with incremented priority slot        |
| `retrying`   | max retries exceeded     | `failed`    | Emit `task.max_retries_exceeded`                 |
| `paused`     | resume signal received   | `running`   | Restore checkpoint; emit `task.resumed`          |
| `paused`     | operator cancel          | `cancelled` | Clear checkpoint; emit `task.cancelled`          |
| `completed`  | —                        | (terminal)  | Write audit log entry                            |
| `failed`     | —                        | (terminal)  | Write audit log entry; alert on-call if critical |
| `cancelled`  | —                        | (terminal)  | Write audit log entry                            |

### 4.3 Retry Backoff Strategy

```python
# Exponential backoff with jitter
def backoff_seconds(retry_count: int, base: float = 2.0, cap: float = 300.0) -> float:
    import random
    delay = min(base ** retry_count, cap)
    jitter = random.uniform(0, delay * 0.25)
    return delay + jitter
```

| Retry # | Base Delay | Max w/ Jitter |
|---------|------------|---------------|
| 1       | 2s         | ~2.5s         |
| 2       | 4s         | ~5s           |
| 3       | 8s         | ~10s          |
| 4       | 16s        | ~20s          |
| 5       | 32s        | ~40s          |

---

## 5. API Routes

### 5.1 Conventions

- Base URL: `https://api.convospan.internal/v1`
- Auth: Bearer JWT (RS256, on-prem JWKS endpoint)
- Content-Type: `application/json`
- Rate Limiting: `X-RateLimit-*` headers on all responses
- Idempotency: `Idempotency-Key` header required for `POST` mutations

### 5.2 Route Definitions

#### Agents

| Method   | Path                          | Description                       | Auth Scope         |
|----------|-------------------------------|-----------------------------------|--------------------|
| `GET`    | `/agents`                     | List all registered agents        | `agent:read`       |
| `GET`    | `/agents/{agent_id}`          | Get agent details                 | `agent:read`       |
| `POST`   | `/agents`                     | Register a new agent              | `agent:write`      |
| `PATCH`  | `/agents/{agent_id}`          | Update agent config/status        | `agent:write`      |
| `DELETE` | `/agents/{agent_id}`          | Deregister agent                  | `agent:admin`      |
| `GET`    | `/agents/{agent_id}/heartbeat`| Check agent liveness              | `agent:read`       |

#### Tasks

| Method   | Path                          | Description                       | Auth Scope         |
|----------|-------------------------------|-----------------------------------|--------------------|
| `POST`   | `/tasks`                      | Dispatch a new task               | `task:write`       |
| `GET`    | `/tasks`                      | List tasks (paginated, filtered)  | `task:read`        |
| `GET`    | `/tasks/{task_id}`            | Get task detail and current state | `task:read`        |
| `POST`   | `/tasks/{task_id}/cancel`     | Cancel a task                     | `task:write`       |
| `POST`   | `/tasks/{task_id}/pause`      | Pause a running task              | `task:write`       |
| `POST`   | `/tasks/{task_id}/resume`     | Resume a paused task              | `task:write`       |
| `GET`    | `/tasks/{task_id}/result`     | Get completed task output         | `task:read`        |
| `GET`    | `/tasks/{task_id}/subtasks`   | List child tasks                  | `task:read`        |

#### Conversations

| Method   | Path                              | Description                   | Auth Scope              |
|----------|-----------------------------------|-------------------------------|-------------------------|
| `POST`   | `/conversations`                  | Create conversation session   | `conversation:write`    |
| `GET`    | `/conversations/{id}`             | Get conversation metadata     | `conversation:read`     |
| `POST`   | `/conversations/{id}/message`     | Submit message to agent       | `conversation:write`    |
| `GET`    | `/conversations/{id}/transcript`  | Get anonymized transcript     | `conversation:read`     |
| `DELETE` | `/conversations/{id}`             | Delete and purge session data | `conversation:admin`    |

#### PII Vault

| Method   | Path                              | Description                   | Auth Scope         |
|----------|-----------------------------------|-------------------------------|--------------------|
| `POST`   | `/pii/tokenize`                   | Tokenize PII field            | `pii:write`        |
| `POST`   | `/pii/detokenize`                 | Detokenize (on-prem only)     | `pii:admin`        |
| `DELETE` | `/pii/tokens/{token}`             | Purge PII token               | `pii:admin`        |

#### Audit

| Method | Path                              | Description                   | Auth Scope      |
|--------|-----------------------------------|-------------------------------|-----------------|
| `GET`  | `/audit`                          | Query audit log (paginated)   | `audit:read`    |
| `GET`  | `/audit/entity/{type}/{id}`       | Audit trail for an entity     | `audit:read`    |

### 5.3 Standard Response Envelopes

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601",
    "version": "1.0.0"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "No task with the provided ID exists.",
    "status_code": 404,
    "trace_id": "uuid"
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601",
    "version": "1.0.0"
  }
}
```

### 5.4 Error Codes

| Code                        | HTTP Status | Description                              |
|-----------------------------|-------------|------------------------------------------|
| `UNAUTHORIZED`              | 401         | Missing or invalid bearer token          |
| `FORBIDDEN`                 | 403         | Insufficient scope for operation         |
| `NOT_FOUND`                 | 404         | Entity does not exist                    |
| `CONFLICT`                  | 409         | Idempotency key collision                |
| `VALIDATION_ERROR`          | 422         | Request body schema violation            |
| `TASK_NOT_FOUND`            | 404         | Task ID does not exist                   |
| `AGENT_UNAVAILABLE`         | 503         | No capable agent available to claim task |
| `PII_EGRESS_BLOCKED`        | 451         | PII egress blocked by firewall policy    |
| `RATE_LIMIT_EXCEEDED`       | 429         | Client rate limit exceeded               |
| `INTERNAL_ERROR`            | 500         | Unhandled internal error                 |

---

## 6. Task Queue Structure

### 6.1 Redis Queue Topology

```
Redis Cluster (on-prem, Sentinel mode)
│
├── Stream: convospan:tasks:critical     (XADD, XREADGROUP)
├── Stream: convospan:tasks:high         (XADD, XREADGROUP)
├── Stream: convospan:tasks:normal       (XADD, XREADGROUP)
├── Stream: convospan:tasks:low          (XADD, XREADGROUP)
│
├── Sorted Set: convospan:tasks:delayed  (ZADD score=epoch, retry scheduling)
├── Sorted Set: convospan:tasks:deadlines (ZADD score=deadline_epoch)
│
├── Hash: convospan:agent:heartbeats     (agent_id → last_seen_epoch)
├── Hash: convospan:task:locks           (task_id → agent_id, TTL=timeout_s)
│
├── PubSub: convospan:events             (task.started, task.completed, etc.)
│
└── String: convospan:idempotency:{key}  (TTL=24h, dedup window)
```

### 6.2 Task Message Schema

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "task_id": "uuid",
  "task_type": "string",
  "priority": "normal",
  "vertical": "healthcare",
  "pii_class": "restricted",
  "capability_required": ["clinical_summary"],
  "payload": {},
  "context": {
    "conversation_id": "uuid",
    "session_token": "string"
  },
  "enqueued_at": "ISO-8601",
  "deadline_utc": "ISO-8601",
  "retry_count": 0,
  "idempotency_key": "string"
}
```

### 6.3 Consumer Group Configuration

```python
CONSUMER_GROUPS = {
    "edge_micro_workers": {
        "streams": [
            "convospan:tasks:critical",
            "convospan:tasks:high",
            "convospan:tasks:normal"
        ],
        "count": 10,
        "block_ms": 2000
    },
    "cloud_gemini_workers": {
        "streams": [
            "convospan:tasks:high",
            "convospan:tasks:normal",
            "convospan:tasks:low"
        ],
        "count": 5,
        "block_ms": 5000
    },
    "dlq_processor": {
        "streams": ["convospan:tasks:dlq"],
        "count": 1,
        "block_ms": 10000
    }
}
```

### 6.4 Dead Letter Queue (DLQ) Policy

```python
DLQ_POLICY = {
    "trigger": "retry_count >= max_retries",
    "stream": "convospan:tasks:dlq",
    "retention_hours": 72,
    "alert_threshold": 5,       # alert after 5 DLQ messages in 1 minute
    "alert_channel": "pagerduty"
}
```

### 6.5 Priority Routing Rules

```python
PRIORITY_ROUTING = {
    "critical": {
        "stream": "convospan:tasks:critical",
        "max_workers": 20,
        "sla_seconds": 5
    },
    "high": {
        "stream": "convospan:tasks:high",
        "max_workers": 10,
        "sla_seconds": 30
    },
    "normal": {
        "stream": "convospan:tasks:normal",
        "max_workers": 5,
        "sla_seconds": 120
    },
    "low": {
        "stream": "convospan:tasks:low",
        "max_workers": 2,
        "sla_seconds": 600
    }
}
```

### 6.6 Worker Heartbeat Protocol

```python
HEARTBEAT = {
    "interval_seconds": 10,
    "key_pattern": "convospan:agent:heartbeats",
    "ttl_seconds": 30,          # worker considered dead if TTL expires
    "requeue_orphaned_tasks": True
}
```

---

## 7. Deployment Notes

### 7.1 Infrastructure Requirements

| Component           | Specification                                          |
|---------------------|--------------------------------------------------------|
| **Python Runtime**  | Python 3.11 (Managed with 'uv'), FastAPI 0.115+, Celery 5.4+ (optional) |
| **PostgreSQL**      | v16, RLS enabled, TDE (pgcrypto), SSL enforced         |
| **Redis**           | v7.2 Cluster, Sentinel HA, `maxmemory-policy noeviction` |
| **Micro-LLM**       | Llama 3.2-1B or Phi-3 Mini, ONNX runtime, GPU optional |
| **Gemini LLM**      | Gemini 2.0 Flash via `google-generativeai` SDK         |
| **Container**       | Docker 26, Kubernetes 1.31+                            |
| **Service Mesh**    | Istio 1.22+ with mTLS enforced                         |
| **Secrets**         | HashiCorp Vault or GCP Secret Manager (on-prem mirror) |

### 7.2 Environment Variables

```bash
# Application
APP_ENV=production
APP_PORT=8000
APP_SECRET_KEY=<vault:secret/convospan/app_secret>
LOG_LEVEL=INFO

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://convospan:<secret>@pg-primary:5432/convospan_db
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://:password@redis-sentinel:26379/0
REDIS_SENTINEL_MASTER=convospan-master
REDIS_MAX_CONNECTIONS=50

# Gemini
GEMINI_API_KEY=<vault:secret/convospan/gemini_key>
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MAX_OUTPUT_TOKENS=8192
GEMINI_TIMEOUT_SECONDS=60

# Micro-LLM (edge)
MICRO_LLM_MODEL_PATH=/models/phi3-mini.onnx
MICRO_LLM_MAX_TOKENS=512
MICRO_LLM_DEVICE=cpu

# PII
PII_ENCRYPTION_KEY=<vault:secret/convospan/pii_key>
PII_VAULT_ENABLED=true
PII_EGRESS_BLOCK=true

# Firewall
SOVEREIGN_FIREWALL_ENABLED=true
SOVEREIGN_FIREWALL_ENDPOINT=http://sentinel.internal:8800
ALLOWED_EGRESS_HOSTS=generativelanguage.googleapis.com

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.internal:4317
SENTRY_DSN=<vault:secret/convospan/sentry_dsn>
```

### 7.3 Docker Compose (Development)

```yaml
version: "3.9"
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - APP_ENV=development
    depends_on:
      - postgres
      - redis
    networks:
      - convospan-net

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: convospan_db
      POSTGRES_USER: convospan
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - convospan-net

  redis:
    image: redis:7.2-alpine
    command: redis-server --requirepass devpassword --maxmemory 512mb --maxmemory-policy noeviction
    volumes:
      - redis_data:/data
    networks:
      - convospan-net

  sentinel:
    image: redis:7.2-alpine
    command: redis-sentinel /etc/sentinel.conf
    depends_on:
      - redis
    networks:
      - convospan-net

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: python -m convospan.worker --queues critical high normal low
    depends_on:
      - redis
      - postgres
    networks:
      - convospan-net

volumes:
  pg_data:
  redis_data:

networks:
  convospan-net:
    driver: bridge
```

### 7.4 Kubernetes Manifests (Production Skeleton)

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: convospan
  labels:
    istio-injection: enabled
---
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: convospan-api
  namespace: convospan
spec:
  replicas: 3
  selector:
    matchLabels:
      app: convospan-api
  template:
    metadata:
      labels:
        app: convospan-api
    spec:
      serviceAccountName: convospan-api
      containers:
        - name: api
          image: convospan/engine-api:1.0.0
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: convospan-secrets
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
---
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: convospan-worker
  namespace: convospan
spec:
  replicas: 5
  selector:
    matchLabels:
      app: convospan-worker
  template:
    metadata:
      labels:
        app: convospan-worker
    spec:
      containers:
        - name: worker
          image: convospan/engine-worker:1.0.0
          command: ["python", "-m", "convospan.worker"]
          envFrom:
            - secretRef:
                name: convospan-secrets
          resources:
            requests:
              cpu: "1000m"
              memory: "1Gi"
            limits:
              cpu: "4000m"
              memory: "4Gi"
```

### 7.5 Sovereign Firewall Compliance Checklist

| Control                            | Status   | Implementation                                          |
|------------------------------------|----------|---------------------------------------------------------|
| PII never leaves firewall          | Required | `SentinelFirewallAgent` inspects all egress payloads   |
| TLS 1.3 enforced for all egress    | Required | Istio egress gateway policy                             |
| mTLS between all internal services | Required | Istio PeerAuthentication `STRICT` mode                  |
| Data residency enforcement         | Required | Kubernetes node affinity to on-prem node pool           |
| Audit log immutability             | Required | `audit_log` table — append-only, no `UPDATE`/`DELETE`  |
| Encryption at rest (PostgreSQL)    | Required | LUKS + `pgcrypto` for PII Vault columns                 |
| Encryption at rest (Redis)         | Required | Redis AOF encrypted volume                              |
| Secret rotation                    | Required | HashiCorp Vault dynamic secrets, 24h TTL                |
| Network egress whitelist           | Required | Allowed: `generativelanguage.googleapis.com` only       |
| Penetration testing cadence        | Required | Quarterly, results stored on-prem                       |
| Vulnerability scanning             | Required | Trivy on all container images in CI pipeline            |

### 7.6 Observability Stack

```yaml
observability:
  tracing:
    provider: OpenTelemetry
    exporter: OTLP (Jaeger on-prem)
    sampling_rate: 0.1            # 10% in production; 100% for critical tasks

  metrics:
    provider: Prometheus
    scrape_interval: 15s
    key_metrics:
      - convospan_tasks_total{status, priority, vertical}
      - convospan_task_duration_seconds{priority, agent}
      - convospan_queue_depth{stream, priority}
      - convospan_pii_blocks_total{reason, vertical}
      - convospan_llm_tokens_total{tier, model}
      - convospan_agent_heartbeat_age_seconds{agent_id}

  logging:
    provider: structlog (Python)
    format: JSON
    destination: Loki (on-prem)
    pii_scrubbing: true           # auto-redact PII fields before log emission

  alerting:
    provider: Alertmanager
    channels: [pagerduty, slack-ops]
    critical_alerts:
      - queue_depth > 1000 for 2m
      - task_failure_rate > 0.05 for 5m
      - pii_block_count > 0       # any PII block is an immediate alert
      - agent_heartbeat_age > 30s
```

### 7.7 CI/CD Pipeline

```yaml
stages:
  - lint:
      tools: [ruff, mypy, bandit]
      fail_on: any_error

  - test:
      unit: pytest --cov=convospan --cov-fail-under=80
      integration: pytest tests/integration -m integration
      contract: pytest tests/contracts -m contract

  - security:
      sast: bandit -r convospan/
      dependency_scan: safety check
      container_scan: trivy image convospan/engine-api:$CI_COMMIT_SHA

  - build:
      dockerfile: Dockerfile
      tags: [latest, "$CI_COMMIT_SHA", "$CI_COMMIT_TAG"]
      push_to: on-prem-registry.convospan.internal

  - deploy_staging:
      cluster: k8s-staging
      namespace: convospan-staging
      strategy: rolling_update
      smoke_tests: true

  - deploy_production:
      cluster: k8s-prod
      namespace: convospan
      strategy: canary
      canary_weight: 10           # 10% traffic initially
      promote_after: 30m
      rollback_on: error_rate > 0.01

  - notify:
      on_success: slack-deployments
      on_failure: pagerduty + slack-incidents
```

---

*ConvoSpan Autonomous Engine — Specification v1.0.0 — Generated 2026-03-01*
*Classification: INTERNAL — Not for external distribution*
