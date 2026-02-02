# ConvoSpan Agent System

The ConvoSpan Agent System is a cyber-physical automation engine designed for high-compliance outreach and lead engagement. It operates as a Deterministic Finite Automaton (DFA) to ensure reliability and security.

## Architecture Overiew

The system follows a "Brain-and-Edge" architecture:
- **Brain (Cloud)**: Orchestrates tasks, manages the state machine, and integrates with high-level LLMs.
- **Edge (Physical Node)**: Executes browser automation locally to bypass bot detection and maintains data sovereignty.

## Agent State Machine

The `AgentExecutor` manages tasks through the following states:

| State | Role | Description |
|---|---|---|
| `HARDWARE_HANDSHAKE` | Handshake | Verifies the identity of the physical edge node. |
| `DATA_INGESTION` | Enrichment | Queries Hunter.io and other sources for contact enrichment. |
| `SANITIZATION` | Sovereignty | Masks PII using the `SovereignFirewall` before cloud transmission. |
| `LLM_GENERATION` | Generation | Generates outreach drafts using masked context in the cloud. |
| `ADVERSARIAL_CHECK` | Critique | A local "Critic" model (Phi-3) reviews the draft for safety. |
| `EXECUTION` | Action | Dispatches the action (e.g., LinkedIn message) via the Edge Browser. |

## Key Components

### 1. AgentExecutor
The core loop located in `src/modules/agent/core/AgentExecutor.ts`. It handles state transitions, retries (DLQ logic), and logging.

### 2. Sovereign Firewall
Located in `src/lib/ai/SovereignFirewall.ts`, it ensures data privacy.
- **Masking**: Replaces sensitive data (names, emails) with tokens.
- **Detokenization**: Restores sensitive data after the cloud processing is complete.
- **Adversarial Critique**: Performs local quality checks to prevent jailbreaks or hallucinations.

### 3. Background Worker
The system uses a background worker (`src/workers/index.ts`) to poll for jobs from the `JobQueue`. This allows for asynchronous execution of long-running agent tasks without blocking the main web server.

## Operational Flow

1. **Task Injection**: A user or schedule triggers a task via `prisma.agentTask`.
2. **Worker Selection**: The `worker` process picks up the job.
3. **Execution Loop**: `AgentExecutor.runToCompletion()` iterates through the states.
4. **Human-in-the-Loop (HITL)**: If a check fails or review is required, the task transitions to `REVIEWING` for manual approval in the dashboard.

## Error Handling & Resilience
- **Fail-Closed**: If the logic/firewall fails, the agent stops immediately.
- **Dead Letter Queue (DLQ)**: Tasks that fail repeatedly are moved to a `FAILED` status for inspection.
- **Hardware Watchdog**: If the physical node disconnects, the task is paused or failed to prevent synchronization issues.
