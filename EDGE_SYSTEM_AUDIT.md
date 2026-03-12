# Edge Node Architecture Audit: EDGE_SYSTEM_AUDIT.md

## System Overview
The **ConvoSpan Edge Node** is a decentralized, cyber-physical component of the ConvoSpan ecosystem. It serves as a "sovereign gateway" that operates on-premise (or on dedicated local hardware) to handle sensitive data processing and physical automation tasks that cannot or should not be performed in a centralized cloud environment.

### Core Responsibilities:
*   **Sovereign Firewall**: Intercepts outgoing data to detect, tokenize, and mask PII (Personally Identifiable Information) before it reaches cloud LLMs.
*   **Micro LLM Inference**: Runs quantized, small language models (SLMs) locally for intent classification, sentiment analysis (Karmic Friction™), and emergency offline generation.
*   **LinkedIn Automation Execution**: Acts as the physical actuator for browser automation, connecting to a local browser instance to perform human-like actions.
*   **Proxy Routing & Tunneling**: Manages local network egress and provides reverse tunneling (e.g., via Cloudflare) to bypass ISP NATs.
*   **Session Management**: Maintains local state for browser sessions, including cookies and identity persistence.
*   **Behavior Simulation**: Injects human-like noise, variable delays, and randomized patterns into automations to prevent platform detection.

## Directory Structure
```text
/services/edge-node
├── database.py              # SQLAlchemy models for local PII Vault and Vector Store
├── main.py                  # FastAPI entry point and API controller
├── requirements.txt         # Python dependencies (FastAPI, SQLAlchemy, Presidio, etc.)
├── Dockerfile               # Container definition for edge deployment
└── services/
    └── local_intelligence.py # Core logic for PII masking, LLM inference, and Vector scoring
```

### Directory Descriptions:
*   `/database.py`: Defines the `PIITokenMap` for secure vaulting and `GoldenRecord` for vector-based adversarial checks.
*   `/main.py`: The primary interface for the SaaS platform, exposing endpoints for sanitization, health checks, and browser execution proxies.
*   `/services/`: Contains the meat of the intelligence layer, including Presidio-based PII analysis and `llama-cpp` integrations.

## Core Runtime Entry Points
*   **main.py**: The FastAPI application server. It is typically started inside a Docker container using `uvicorn`.
*   **Runtime Start Command**: `uvicorn main:app --host 0.0.0.0 --port 8000`

## LinkedIn Automation Layer
The Edge Node serves as the orchestrator for browser-based tasks. It integrates with **Puppeteer/Playwright** (running in a separate `browser-node` container or locally).

### Architecture:
*   **Browser Manager**: Remote connection via `browserWSEndpoint`.
*   **Session Persistence**: Cookies and local storage handled via the browser node, with identity resolution provided by the Edge Node's Vault.
*   **Implemented Actions**:
    *   `visit_profile`: Navigates to a specific LinkedIn URL.
    *   `send_connection`: Clicks "Connect", optionally types a personalized note.
    *   `send_message`: Dispatches InMails or direct messages.
    *   `check_connection`: Scrapes status to verify if a connection request was accepted.

## Behavioral Engine
Human-like browsing is enforced through the `Humanizer` class (integrated from the SaaS side but executed via the Edge proxy).

### Key Features:
*   **Variable Keystroke Delays**: 30ms-130ms per character for typing.
*   **Thinking Pauses**: Occasional 0.3s-0.8s pauses mid-typing.
*   **Scroll Patterns**: Randomized `window.scrollBy` increments with pauses.
*   **Session Duration**: Randomized dwell times on profiles to simulate reading behavior.

## Sovereign Firewall
The firewall uses **Microsoft Presidio** for pattern-based detection and **GLiNER-style** semantic tagging (simulated) for context-aware masking.

### PII Vault & Masking:
*   **Detection**: Identifies `PERSON`, `EMAIL`, `PHONE_NUMBER`, `LOCATION`, and `ORG`.
*   **Tokenization**: Replaces "Rajesh" with `<PERSON_1 role='Executive'>`.
*   **Local Vault**: Stores the original value in an encrypted `PIITokenMap` table, ensuring the SaaS cloud only sees the token.

## Local AI Inference
The node utilizes **llama.cpp** for high-efficiency, quantized model execution.

### Configuration:
*   **Model**: Typically `Phi-3-mini-4k-instruct.gguf` or similar 3B-parameter models.
*   **Quantization**: 4-bit (q4_k_m) for minimal RAM impact.
*   **Format**: GGUF.
*   **Threads**: Defaults to 4 (optimized for ARM/Jetson/Raspberry Pi).
*   **Tasks**: Sentiment analysis (Karmic Friction scoring), response critiquing (Vector similarity >= 0.8), and emergency offline drafting.

## Task Execution Model
Tasks are received via REST API calls from the SaaS platform, which are then proxied to the required local service.

*   **Queueing**: Handled by the SaaS `JobQueue` (Redis), with the Edge Node acting as the final execution point.
*   **polling**: The SaaS platform pushes tasks to the Edge Node via its public URL (secured by tunnel).
*   **Task Lifecycle**: Received -> Attested (Hardware Sig) -> Executed -> Hardware Ack returned to SaaS.

## Security & Identity
*   **Hardware Signature**: Every request validates the `HARDWARE_SIGNATURE` env var.
*   **Identity Resolution**: Restricted endpoint `/v1/reidentify` requires a valid `session_id` and is only used in secure contexts.
*   **Safety Net**: If the Edge Node returns a mismatching signature, the SaaS platform immediately terminates the connection.

## Environment Configuration
| Variable | Description |
| :--- | :--- |
| `HARDWARE_SIGNATURE` | Unique UUID representing the physical device. |
| `DATABASE_URL` | Connection string for the local pgvector database. |
| `OFFLINE_MODEL_PATH` | Path to the local GGUF model file. |
| `PORT` | Edge Node service port (default 8000). |
| `TUNNEL_TOKEN` | Token for reverse proxy (Cloudflare/Frp). |

## Resource Requirements
*   **CPU**: 2-4 vCPUs (dedicated for inference).
*   **RAM**: 4GB - 8GB (4GB for model, 1-2GB for vector DB).
*   **Capacity**: Supports up to 10 concurrent browser sessions (constrained by `browserless` settings).

## Docker & Deployment
*   **Dockerfile**: Multi-stage build (Python 3.9 slim).
*   **Deployment**: Typically deployed via `docker-compose.edge.yml` on local hardware.
*   **Command**: `docker-compose up -d`

## External Integrations
*   **Postgres (pgvector)**: For local vector storage of "Golden Records".
*   **Browserless/Chrome**: For browser automation execution.
*   **Cloudflare Tunnel**: For secure NAT traversal.
*   **SaaS API**: Communicates back to the main ConvoSpan platform.

## Known Limitations
*   **Model Latency**: Local SLM inference can take 2-5 seconds per response.
*   **Network Dependency**: Requires a stable outgoing connection for the reverse tunnel.
*   **Isolation**: No multi-tenant support at the Edge Node level (single node = single team).
