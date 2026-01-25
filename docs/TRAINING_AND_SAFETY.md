# Micro-LLM: Training & Safety Philosophy

## Why SFT and not RLHF/DPO?

For the "Enforcement & Compliance" Micro-LLM (Phi-3-mini on Raspberry Pi), we explicitly chose **Supervised Fine-Tuning (SFT)** over Reinforcement Learning from Human Feedback (RLHF) or Direct Preference Optimization (DPO).

### 1. Determinism & Stability
- **SFT** maps inputs to outputs directly based on examples. It is more predictable.
- **RLHF/DPO** introduces optimization dynamics that can lead to "reward hacking" or subtle behavioral shifts that are hard to audit in a compliance context.
- We need the model to be boring and strictly follow instructions, not to be "creative" or "maximally helpful."

### 2. Data Sovereignty (GDPR / DPDP)
- Our training data is static JSONL files.
- We do **not** use any online learning or user interactions to update the model in real-time.
- This creates a **Data Firewall**: The model logic is frozen at build time. User PII never enters the gradient descent process.

### 3. Edge Constraints
- **Phi-3-mini (3.8B)** is small enough to run on a Raspberry Pi 4 CPU.
- SFT with **LoRA (Low-Rank Adaptation)** allows us to train efficiently without needing a massive GPU cluster, keeping the supply chain simple and auditable.

## Safety Architecture

Safety is enforced in layers:

1.  **Model Layer (Internal)**: Trained via SFT on `refusal_generation.jsonl` to inherently recognize and refuse unsafe prompts.
2.  **Application Layer (External)**: `safety_rules.py` provides a deterministic code-based firewall.
    - **Length limits**: Hard truncate at 128 tokens.
    - **Keyword blocking**: "Ignore previous instructions", "Social Security", etc. are blocked *before* or *after* generation.
    - **Channel Consent**: Logic checks strictly enforce platform rules (e.g., no WhatsApp outbound without verified opt-in).

## Capabilities & Limitations

**What this model CAN do:**
- rewrite text to be more polite.
- Classify text against specific policy categories.
- Extract simple objections from sales transcripts.
- Refuse requests that violate safety guidelines.

**What this model CANNOT do:**
- General knowledge question answering (it is not a chatbot).
- Code generation or math.
- Remember previous conversations (Stateless).
- Access the internet.

## Verifiability

- **Training**: Fully reproducible via `train_phi3.py` and `train_config.yaml`.
- **Evaluation**: Deterministic `eval_suite.py` checks logic without stochastic LLM calls.
- **Audit**: All training data is version-controlled JSONL.
