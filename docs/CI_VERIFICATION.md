# CI-Based Verification for Phi-3 Micro-LLM

## Overview

This document describes the production verification pipeline for the Phi-3 micro-LLM enforcement layer. Verification runs in CI using real inference, not mocks.

## Why CI-Based Verification?

**Local hardware (Raspberry Pi) is not available during development.**

The verification pipeline:
- Builds `llama.cpp` from source in a clean Linux environment
- Downloads the Phi-3 model (Q4_K_M quantization)
- Runs real CPU inference with deterministic settings
- Validates outputs against strict safety criteria
- Fails the build on any violation

This approach ensures:
- **Reproducibility**: Same environment every time
- **Auditability**: All runs are logged and archived
- **Non-bypassable**: Developers cannot skip verification
- **Hardware-independent**: No physical devices required

## What This Verifies

✅ **Model Loading**: Phi-3 GGUF file loads correctly  
✅ **Inference Execution**: llama.cpp runs without errors  
✅ **Safety Enforcement**: Refusal of unsafe requests  
✅ **Output Constraints**: Length limits are respected  
✅ **Tone Normalization**: Aggressive language is softened  
✅ **Determinism**: Same input produces same output (temp=0, seed=42)

## What This Does NOT Verify

❌ **Edge Latency**: Raspberry Pi 4 inference speed (<1s requirement)  
❌ **Network Reliability**: localhost:8081 connectivity  
❌ **Production Load**: Concurrent request handling  
❌ **Hardware Compatibility**: Specific Pi model quirks

These require physical hardware testing and are deferred to staging/pilot phases.

## Verification Guarantees

1. **No Mocks**: All inference is real via llama.cpp
2. **Fail Fast**: Any error stops the build immediately
3. **Deterministic**: Fixed seed and temperature ensure reproducibility
4. **Auditable**: Full logs uploaded as GitHub Actions artifacts

## Running Verification

### Locally (requires Docker)
```bash
./scripts/verify_ci.sh
```

### In CI (automatic)
- Runs on every PR to `main` or `develop`
- Runs on every push to `main`
- Blocks merge if verification fails

### Auditor Rerun
1. Navigate to GitHub Actions tab
2. Select "Phi-3 Verification" workflow
3. Click "Re-run jobs"
4. Download artifacts for logs

## File Structure

```
evaluation/
├── eval_suite_prod.py       # Production verification script (NO MOCKS)
├── eval_cases_prod.json     # Deterministic test cases

docker/
├── Dockerfile.verify         # Verification environment

scripts/
├── verify_ci.sh              # CI execution script

.github/workflows/
├── verify.yml                # GitHub Actions workflow
```

## Test Cases

Current coverage (5 cases):
1. **Refusal Enforcement**: Blocks requests for sensitive data
2. **Policy Classification**: Approves safe requests
3. **Tone Normalization**: Softens aggressive language
4. **Output Length Limit**: Enforces character limits
5. **Safety Refusal**: Blocks unethical requests

## Failure Modes

Verification fails if:
- llama.cpp binary is missing
- Phi-3 model file is missing
- Inference times out (>30s)
- Output contains forbidden phrases
- Output exceeds length limits
- Exit code is non-zero

## Maintenance

- **Model Updates**: Update `Dockerfile.verify` with new model URL
- **Test Cases**: Add to `eval_cases_prod.json` (JSON format)
- **llama.cpp Version**: Pin specific commit in Dockerfile

## Compliance Notes

This verification pipeline satisfies:
- **Determinism Requirement**: Fixed seed ensures reproducibility
- **Audit Trail**: All runs logged in GitHub Actions
- **Non-Bypassable**: CI blocks merge on failure

For production deployment, additional hardware-specific testing is required.
