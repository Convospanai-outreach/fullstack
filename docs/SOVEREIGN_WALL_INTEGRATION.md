# Sovereign Wall: Hardware Integration Guide

This document outlines the technical specifications and integration protocols for the **Sovereign Wall** hardware (the Edge Node) within the CraftMyFunnel ecosystem.

## 1. Overview

The Sovereign Wall is a physical device (e.g., NVIDIA Jetson, Raspberry Pi 5) that provides a secure execution environment for:
- **Sovereign Firewall**: Local PII sanitization and masking.
- **Identity Vault**: Secure storage and re-identification of lead data.
- **Adversarial Judge**: Local vector-based critique of agent outputs.
- **Offline Intelligence**: SLM (Small Language Model) fallback when internet is unavailable.

## 2. Hardware Requirements

- **Processor**: ARM64 preferred (NVIDIA Jetson Orin Nano/NX or Raspberry Pi 5 8GB).
- **RAM**: Minimum 8GB (for LLM/Vector DB operations).
- **Storage**: 64GB+ NVMe or High-Speed SD (U3 class).
- **OS**: Ubuntu 22.04 LTS (JetPack 6.x for Jetson).

## 3. Software Setup

The Edge Node runs as a containerized FastAPI application.

### Installation Steps

1. **Clone the Edge Node Services**:
   ```bash
   git clone <repo-url>
   cd services/edge-node
   ```

2. **Configure Environment**:
   Create a `.env` file on the hardware:
   ```env
   HARDWARE_SIGNATURE=uuid-550e8400-e29b-41d4-a716-446655440000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edge_db
   OFFLINE_MODEL_PATH=./models/Phi-3-mini-4k-instruct.gguf
   ```

3. **Deploy via Docker**:
   ```bash
   docker-compose -f docker-compose.edge.yml up -d
   ```

## 4. Hardware Attestation

The `HardwareService` in the main application enforces a **Strict Attestation** protocol to ensure only verified physical devices can process PII.

```mermaid
sequenceDiagram
    participant App as CraftMyFunnel App
    participant Edge as Sovereign Wall (Hardware)
    
    App->>Edge: GET /health
    Edge-->>App: { status: "ONLINE", hardware_id: "SIG_..." }
    App->>App: Compare SIG_... with ENV[HARDWARE_SIGNATURE]
    alt Signature Match
        App->>App: Proceed with Execution
    else Mismatch
        App->>App: FAIL CLOSED (Lockdown)
    end
```

## 5. API Surface

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/health` | GET | Connection and identity verification. |
| `/v1/sanitize` | POST | Mask PII and return metadata-aware tokens. |
| `/v1/critique` | POST | Compare output against local "Golden Records". |
| `/v1/reidentify` | POST | Reverse lookup for tokenized PII (Identity Vault). |
| `/search` | POST | Semantic search against local vector database. |

## 6. Security Protocols

### Zero-Knowledge Boundary
Plaintext PII never leaves the local network of the Sovereign Wall. Only "Masked Tokens" are transmitted to the cloud-based Brain.

### Webhook Verification
Incoming webhooks from the Edge Node are signed with an `X-Compliance-Hash`.
- **Algorithm**: HMAC-SHA256
- **Verification**: Handled by `IdentityService.verifyWebhook`.

## 7. Networking & Resilience

### Local Discovery
In a local environment, the app connects via:
`EDGE_NODE_URL=http://localhost:8000`

### Remote Access (Cloud Hybrid)
For remote hardware integration, use the **Tunnel Service** (Cloudflared/FRP) included in `docker-compose.edge.yml` to punch through NAT/ISP firewalls without exposing ports.

---
> [!IMPORTANT]
> **Fail-Closed Policy**: If the `HardwareService` cannot verify the physical presence of the Sovereign Wall, all sensitive operations (Sanitization, Identity Resolution) will fail immediately to prevent data leaks.
