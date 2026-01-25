# CI-Based Verification for Phi-3 Micro-LLM

## Overview

This document describes the production verification pipeline for the Phi-3 micro-LLM enforcement layer. **All verification runs in CI using real inference. No mocks are used.**

---

## Why CI-Based Verification?

**Local hardware (Raspberry Pi) is not available during development and CI.**

The verification pipeline:

1. Builds `llama.cpp` from source in a clean Ubuntu 22.04 environment
2. Downloads the Phi-3 model (Q4_K_M quantization, ~2.4GB)
3. Runs real CPU inference with deterministic settings (`temp=0`, `seed=42`)
4. Validates outputs against strict safety criteria
5. **Fails the Docker build on any violation**

This approach ensures:

| Property | Guarantee |
|----------|-----------|
| **Reproducibility** | Same Docker environment every build |
| **Auditability** | All runs logged and archived as GitHub artifacts |
| **Non-bypassable** | Developers cannot skip verification; merge is blocked |
| **Hardware-independent** | No physical devices required |

---

## What This Verifies

| Check | Description |
|-------|-------------|
| ✅ Model Loading | Phi-3 GGUF file loads correctly |
| ✅ Inference Execution | llama.cpp runs without errors |
| ✅ Safety Enforcement | Refusal of unsafe requests (PII, fraud, harassment) |
| ✅ Output Constraints | Length limits are respected |
| ✅ Tone Normalization | Aggressive language is softened |
| ✅ Policy Classification | Safe/Unsafe classification works |
| ✅ Determinism | Same input produces same output |
| ✅ India Context | Indian business idioms are not falsely flagged |

---

## What This Does NOT Verify

| Gap | Reason |
|-----|--------|
| ❌ Edge Latency | Raspberry Pi 4 inference speed (<1s requirement) requires physical hardware |
| ❌ Network Reliability | localhost:8081 connectivity is deployment-specific |
| ❌ Production Load | Concurrent request handling requires load testing |
| ❌ Hardware Compatibility | Specific Pi model quirks need physical testing |

These require physical hardware testing and are deferred to staging/pilot phases.

---

## Verification Guarantees

1. **NO MOCKS**: All inference is real via llama.cpp binary
2. **FAIL FAST**: Any error stops the build immediately
3. **NO FALLBACKS**: Missing binary or model = failure, not warning
4. **DETERMINISTIC**: Fixed seed (42) and temperature (0.0) ensure reproducibility
5. **AUDITABLE**: Full logs uploaded as GitHub Actions artifacts (90-day retention)
6. **BLOCKING**: CI failure prevents merge to protected branches

---

## Test Cases (12 total)

| # | Task | Description |
|---|------|-------------|
| 1 | REFUSAL_ENFORCEMENT_FINANCIAL | Blocks phishing for bank details |
| 2 | REFUSAL_ENFORCEMENT_PII | Blocks SSN/identity requests |
| 3 | POLICY_CLASSIFICATION_SAFE | Approves benign business requests |
| 4 | POLICY_CLASSIFICATION_UNSAFE | Blocks harmful requests |
| 5 | TONE_NORMALIZATION | Softens aggressive language |
| 6 | REWRITE_SAFETY_PRESERVE_INTENT | Preserves intent while removing aggression |
| 7 | SAFETY_REFUSAL_FRAUD | Blocks fraudulent document requests |
| 8 | SAFETY_REFUSAL_HARASSMENT | Blocks harassing content |
| 9 | OUTPUT_LENGTH_ENFORCEMENT | Enforces character limits |
| 10 | INDIA_CONTEXT_SAFE | Indian idioms not falsely flagged |
| 11 | WHATSAPP_CONSENT_GATE | Consent requirements acknowledged |
| 12 | DETERMINISM_CHECK | Output consistency verified |

---

## Running Verification

### Locally (requires Docker)

```bash
./scripts/verify_ci.sh
```

Estimated time: 15-30 minutes (first run includes model download).

### In CI (automatic)

- Runs on every PR to `main` or `develop`
- Runs on every push to `main`
- Can be manually triggered via GitHub Actions
- **Blocks merge if verification fails**

### Auditor Rerun

1. Navigate to GitHub → Actions tab
2. Select "Phi-3 Verification" workflow
3. Click "Run workflow" or "Re-run jobs"
4. Download `verification-logs-*` artifact for complete logs

---

## File Structure

```
evaluation/
├── eval_suite_prod.py       # Production verification script (NO MOCKS)
├── eval_cases_prod.json     # 12 deterministic test cases

docker/
├── Dockerfile.verify        # Verification environment (Ubuntu 22.04)

scripts/
├── verify_ci.sh             # CI execution script (--no-cache)

.github/workflows/
├── verify.yml               # GitHub Actions workflow (60min timeout)
```

---

## Failure Modes

Verification **FAILS** (exit 1) if:

| Condition | Result |
|-----------|--------|
| llama.cpp binary missing | FAIL |
| Phi-3 model file missing | FAIL |
| Model file too small (<500MB) | FAIL |
| Binary not executable | FAIL |
| Inference timeout (>60s) | FAIL |
| Exit code non-zero | FAIL |
| stdout empty | FAIL |
| stderr contains "error" | FAIL |
| Output contains forbidden phrase | FAIL |
| Output exceeds length limit | FAIL |
| Output below minimum length | FAIL |
| Missing required phrase in output | FAIL |

**There are no warnings. There are no bypasses. Failure = blocked merge.**

---

## Maintenance

| Change | File to Update |
|--------|----------------|
| Model version | `docker/Dockerfile.verify` (wget URL) |
| llama.cpp version | `docker/Dockerfile.verify` (git tag) |
| Test cases | `evaluation/eval_cases_prod.json` |
| Validation logic | `evaluation/eval_suite_prod.py` |
| CI settings | `.github/workflows/verify.yml` |

---

## Compliance Notes

This verification pipeline satisfies:

| Requirement | How Satisfied |
|-------------|---------------|
| Determinism | Fixed seed=42, temp=0.0 |
| Audit Trail | GitHub Actions artifacts (90-day retention) |
| Non-Bypassable | CI blocks merge on failure |
| Reproducibility | Docker ensures identical environment |
| No Mock Inference | Real llama.cpp binary with real model |

---

## Limitations

This pipeline verifies **model behavior**, not **deployment environment**.

For production deployment:
- Physical hardware testing is required for latency SLAs
- Network configuration testing is deployment-specific
- Scaling characteristics require load testing

The CI verification is a **gate**, not a complete acceptance test.
