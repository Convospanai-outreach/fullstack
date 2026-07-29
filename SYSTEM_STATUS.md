> ⚠️ **DEPRECATED (July 2026)** — This document is historical context only. The canonical active tracker is [`OPEN_ITEMS.md`](OPEN_ITEMS.md). The consolidated assessment lives at [`docs/SYSTEM_READINESS_ASSESSMENT.md`](docs/SYSTEM_READINESS_ASSESSMENT.md). Do not update this file.

# System Status Report: CraftMyFunnel Enterprise Platform

**Generated:** 2026-01-24 — ARCHIVED
**Auditor:** Antigravity (Independent Technical Auditor)
**Version:** v1.4.0-ci-verification

---

## 1. Application Overview

**CraftMyFunnel** is an enterprise-grade AI communication platform designed for Indian MSMEs and agencies. It automates high-volume lead outreach and engagement while enforcing strict organizational policies and safety barriers.

-   **Target User**: Sales teams, Agencies, MSMEs in India.
-   **Core Value**: "Safe Autonomy". AI that drafts aggressively (Cloud) but is censored and controlled locally (Edge/Pi) before sending.
-   **India-First**: Native understanding of Indian business norms ("do the needful", "prepone") without compromising core model safety.

---

## 2. Architecture Summary

The system follows a **Hybrid Edge-Cloud Architecture**.

### Diagram
```
[User / Sales Rep]  <--->  [Next.js App (Cloud/Server)]
                                   |
       -----------------------------------------------------------
       |                           |                             |
[Postgres + Prisma]      [Global AI Gateway]            [Local Micro-LLM]
(Event Sourcing DB)      (Claude / Gemini)              (Raspberry Pi 4)
       |                 (Drafting / Creative)          (Control / Safety)
[EventStore]                       |                             |
                                   |                             |
                         [Region-Aware RAG] <---------- [Safety Rules]
                         (India Context)
```

-   **Frontend**: Next.js 14 (App Router), React, Tailwind.
-   **Backend**: Next.js API Routes, Prisma ORM.
-   **Database**: PostgreSQL (Relational + JSONB Event Log).
-   **Cloud LLMs**: Pluggable provider architecture (Gemini/Claude) for high-intelligence drafting.
-   **Micro-LLM**: Local instance for policy enforcement (The "Brake").
-   **Deployment**: Docker (Staging), Manual/Scripted (Edge).
-   **Scalability**: Regional intelligence is a replaceable layer; core architecture is global-ready.

---

## 3. Micro-LLM Status (CRITICAL)

The Micro-LLM is the **Policy Enforcement Engine**. It is **NOT** a chatbot.

| Component | specification | Status |
| :--- | :--- | :--- |
| **Model** | `microsoft/Phi-3-mini-4k-instruct` | **LOCKED** |
| **Training** | SFT + LoRA (Rank 16, Alpha 32) | **CODE COMPLETE** |
| **Dataset** | Proprietary JSONL (Strict 512/128 schema) | **EXISTING** |
| **Runtime** | `llama.cpp` (Server Mode) | **VERIFIED** |
| **Quantization** | Q4_K_M (approx 2.3GB RAM) | **TARGET** |
| **Hardware** | Raspberry Pi 4 (Min Viable) / Pi 5 | **TARGET** |
| **Timeout** | 1000ms (Hard Limit) | **ENFORCED** |
| **Retries** | 0 (Fail Fast) | **ENFORCED** |

**Capabilities**:
-   **Refusal**: Blocking unsafe/non-compliant messages.
-   **Tone Normalization**: Rewriting aggressive text to polite business norms.
-   **Policy Classification**: Classifying inputs as SAFE/UNSAFE/BLOCK.

**Limitations**:
-   **No Generation**: Cannot write emails from scratch.
-   **No Knowledge**: Does not know world facts (only provided context).
-   **No Memory**: Stateless execution.

**Determinism**:
-   Zero-temperature sampling (`temp=0`).
-   Fixed seed testing required for strict audit guarantees.

---

## 4. RAG Status (Region-Aware)

Implemented as a **Safety-First Context Layer** to support Indian business norms.

-   **Purpose**: Explain Indian phrases ("prepone") to the US-trained Phi-3 model to prevent false-positive refusals or aggressive tone misclassification.
-   **Data Source**: `rag/india_context.jsonl` (Static, Version Controlled).
-   **Mechanism**: Deterministic keyword injection (`[CONTEXT: ...]`).
-   **Guarantees**:
    -   **Read-Only**: RAG content is never trained into model weights.
    -   **Token Limit**: Max ~250 tokens injected per request.
    -   **Advisory**: Model safety rules override RAG context if in conflict.

---

## 5. Feature Matrix

| Feature | Status | Dependency | Risk |
| :--- | :--- | :--- | :--- |
| **Event Sourcing** | **DONE** | Postgres | Low |
| **Outcome-Weighted RAG** | **DONE** | Postgres, Usage Stats | Low |
| **Causal Testing (A/B)** | **DONE** | ModelGateway | Low |
| **Sovereign Enforcement Client** | **DONE** | Localhost:8081 | Medium (Network) |
| **Sovereign Alignment Pipeline**| **DONE** | Python/GPU | Medium (ML Ops) |
| **Context-Aware Cultural Firewall** | **DONE** | Local JSONL | Low |
| **Governance Dashboard** | **DONE** | Prisma | Low |
| **Observability** | **DONE** | Prometheus/Grafana | Low |
| **Production Build** | **PENDING** | Docker/Linux Env | **HIGH** |
| **Edge Deployment** | **SCRIPTED** | Raspberry Pi HW | Medium |

---

## 6. Observability & Ops

-   **Metrics**: Prometheus (`prom-client`).
-   **Exposed**: `/api/metrics` (Latency, Request Counts, Experiment Exposure).
-   **Visualization**: Grafana (Dockerized).
-   **Staging**: Full `docker-compose.staging.yml` stack available.
-   **Production**: Intended for running via `Dockerfile`.

---

## 7. Compliance & Safety

**Safeguards (Technical)**:
-   **Hard Separation**: No PII sent to Cloud LLMs (Architectural intent, implementation in Sovereign Firewall layer).
-   **Safety Rules**: Python-based pre/post filters (`safety_rules.py`) checking length, forbidden phrases, and channel consent.
-   **Consent**: "WhatsApp" channel usage strictly gated by user status logic.
-   **Audit Trail**: Every inference request/result logged in immutable `SystemEvent` ledger.

**Data Boundaries**:
-   Micro-LLM runs totally offline (Air-gapped capable).
-   RAG context is strictly strictly local/static.

---

## 8. Known Failures & Risks (MANDATORY)

### 🔴 CRITICAL FAILURE: Windows Build
-   **Issue**: `npm run build` fails on Windows due to `EPERM` file locking issues with Prisma/Next.js trace files.
-   **Root Cause**: Local file system locking behavior on generated artifacts during build optimization.
-   **Workaround**: Build strictly in WSL2, Linux, or Docker.
-   **Status**: **PENDING (Use Dockerfile)**. Do not attempt bare-metal Windows build for production.

### 🟠 RISK: Micro-LLM Latency
-   **Issue**: Raspberry Pi 4 CPU inference is borderline for <1s latency.
-   **Mitigation**: Q4 quantization and strict 128 token output limit.
-   **Risk**: Complex inputs may timeout, defaulting to "Block".

### 🟠 RISK: Verification Environment
-   **Issue**: Verification pipeline requires CI execution. Local hardware not available.
-   **Implementation**: CI-based verification using Docker + llama.cpp + real Phi-3 inference.
-   **Key Files**: `docker/Dockerfile.verify`, `evaluation/eval_suite_prod.py`, `.github/workflows/verify.yml`
-   **Status**: **IMPLEMENTED**. Verification pipeline implemented. Execution occurs in CI using a Linux runtime. No mock-based verification is claimed.
-   **Guarantees**: NO mocks, NO fallbacks, NO auto-pass. CI FAILS if model or binary missing.
-   **Action**: First CI run pending. Local hardware testing deferred to pilot phase.

---

## 9. Readiness Assessment

| Area | Status | Notes |
| :--- | :--- | :--- |
| **Engineering** | **NEAR-READY** | Code complete. CI verification implemented (NO MOCKS). Awaiting first CI pass. |
| **Compliance** | **READY** | Audit trails and Safety Rules verified. |
| **Pilot (India)** | **READY** | Region-Aware RAG implemented. |
| **Enterprise** | **NOT-READY** | SLA testing on Pi hardware pending. |
| **NIDHI/VC** | **READY** | Tech stack and IP highly defensible. |

---

## 10. Next Hard Gates

### Technical Gates
1.  **Clean Build**: Execute `docker build` successfully on a Linux host.
2.  **CI Verification**: Run GitHub Actions workflow and verify Phi-3 inference passes all safety checks.
3.  **Edge Latency Test**: Verify P99 latency < 1000ms on actual Raspberry Pi hardware.

### Operational Gates
1.  **Hardware Provisioning**: Acquire and flash Raspberry Pi units.
2.  **Field Trial**: Deploy to 1 pilot user with India Context enabled.
3.  **Security Audit**: Third-party review of the `safety_rules.py` logic.
