#!/usr/bin/env python3
"""
Production Evaluation Suite for Phi-3 Micro-LLM
NO MOCKS. NO FALLBACKS. FAIL FAST.

This suite runs real inference via llama.cpp and validates outputs.
Designed for CI execution on Linux.

HARD CONSTRAINTS (NON-NEGOTIABLE):
- DO NOT mock inference
- DO NOT auto-pass on failure  
- DO NOT silently continue on errors
- Verification MUST FAIL if runtime is missing
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Paths (CI environment)
LLAMA_CPP_BINARY = Path(os.environ.get("LLAMA_CPP_BINARY", "/opt/llama.cpp/build/bin/llama-cli"))
MODEL_PATH = Path(os.environ.get("MODEL_PATH", "/opt/models/phi-3-mini-4k-instruct-q4.gguf"))
EVAL_CASES_PATH = Path(__file__).parent / "eval_cases_prod.json"

# Output log path
LOG_PATH = Path(__file__).parent / "verification.log"


class VerificationError(Exception):
    """Raised when verification fails - NEVER BYPASS"""
    pass


def log(message: str) -> None:
    """Log to both stdout and file for audit trail"""
    timestamp = datetime.utcnow().isoformat() + "Z"
    formatted = f"[{timestamp}] {message}"
    print(formatted)
    with open(LOG_PATH, "a") as f:
        f.write(formatted + "\n")


def check_prerequisites() -> None:
    """
    Verify all required binaries and models exist.
    FAILS IMMEDIATELY if any prerequisite is missing.
    """
    log("Checking prerequisites...")
    
    # Check binary exists
    if not LLAMA_CPP_BINARY.exists():
        raise VerificationError(
            f"FATAL: llama.cpp binary not found: {LLAMA_CPP_BINARY}\n"
            "Build llama.cpp from source before running verification."
        )
    
    # Check binary is a file (not directory)
    if not LLAMA_CPP_BINARY.is_file():
        raise VerificationError(
            f"FATAL: llama.cpp binary path is not a file: {LLAMA_CPP_BINARY}"
        )
    
    # Check binary is executable
    if not os.access(LLAMA_CPP_BINARY, os.X_OK):
        raise VerificationError(
            f"FATAL: llama.cpp binary is not executable: {LLAMA_CPP_BINARY}\n"
            "Run: chmod +x {LLAMA_CPP_BINARY}"
        )
    
    # Check model exists
    if not MODEL_PATH.exists():
        raise VerificationError(
            f"FATAL: Model file not found: {MODEL_PATH}\n"
            "Download Phi-3 GGUF model before running verification."
        )
    
    # Check model is a file
    if not MODEL_PATH.is_file():
        raise VerificationError(
            f"FATAL: Model path is not a file: {MODEL_PATH}"
        )
    
    # Check model file size (Q4 Phi-3 should be ~2GB+)
    model_size_mb = MODEL_PATH.stat().st_size / (1024 * 1024)
    if model_size_mb < 500:
        raise VerificationError(
            f"FATAL: Model file too small ({model_size_mb:.1f}MB). "
            "Expected ~2GB+ for Phi-3 Q4. Download may be corrupted."
        )
    
    # Check eval cases exist
    if not EVAL_CASES_PATH.exists():
        raise VerificationError(
            f"FATAL: Eval cases not found: {EVAL_CASES_PATH}"
        )
    
    log(f"✓ Binary: {LLAMA_CPP_BINARY}")
    log(f"✓ Model: {MODEL_PATH} ({model_size_mb:.1f}MB)")
    log(f"✓ Cases: {EVAL_CASES_PATH}")


def run_inference(prompt: str, max_tokens: int = 128) -> str:
    """
    Run real inference via llama.cpp.
    NO MOCKS. NO FALLBACKS. FAIL IMMEDIATELY ON ERROR.
    """
    cmd = [
        str(LLAMA_CPP_BINARY),
        "-m", str(MODEL_PATH),
        "-p", prompt,
        "-n", str(max_tokens),
        "--temp", "0.0",      # Deterministic - REQUIRED
        "--seed", "42",       # Reproducible - REQUIRED  
        "-c", "512",          # Context size
        "--no-display-prompt" # Don't echo prompt in output
    ]
    
    log(f"  Executing: {' '.join(cmd[:6])}...")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,  # 60s hard timeout
            check=False  # We check manually for clearer errors
        )
    except subprocess.TimeoutExpired:
        raise VerificationError(
            f"INFERENCE TIMEOUT (60s): Prompt='{prompt[:50]}...'\n"
            "This indicates a runtime failure, not a performance issue."
        )
    except FileNotFoundError:
        raise VerificationError(
            f"BINARY NOT FOUND: {LLAMA_CPP_BINARY}\n"
            "The binary may have been deleted during execution."
        )
    
    # CHECK 1: Exit code must be 0
    if result.returncode != 0:
        raise VerificationError(
            f"LLAMA.CPP FAILED (exit={result.returncode})\n"
            f"stderr: {result.stderr}\n"
            f"stdout: {result.stdout[:500] if result.stdout else 'EMPTY'}"
        )
    
    # CHECK 2: stdout must be non-empty
    if not result.stdout or not result.stdout.strip():
        raise VerificationError(
            f"EMPTY OUTPUT: llama.cpp returned no text\n"
            f"stderr: {result.stderr}"
        )
    
    # CHECK 3: stderr should not contain error indicators
    if result.stderr:
        stderr_lower = result.stderr.lower()
        error_indicators = ["error", "fatal", "failed", "exception", "abort"]
        for indicator in error_indicators:
            if indicator in stderr_lower:
                raise VerificationError(
                    f"STDERR CONTAINS ERROR INDICATOR '{indicator}'\n"
                    f"stderr: {result.stderr}\n"
                    "This may indicate a silent failure."
                )
    
    output = result.stdout.strip()
    log(f"  Raw output length: {len(output)} chars")
    
    return output


def validate_case(case: Dict, case_num: int) -> None:
    """
    Validate a single test case.
    FAILS IMMEDIATELY on any constraint violation.
    """
    task = case.get("task", "UNKNOWN")
    input_text = case.get("input", "")
    
    log(f"")
    log(f"[Case {case_num}] Task: {task}")
    log(f"  Input: '{input_text[:80]}{'...' if len(input_text) > 80 else ''}'")
    
    # Run real inference
    output = run_inference(input_text)
    log(f"  Output: '{output[:80]}{'...' if len(output) > 80 else ''}'")
    
    # VALIDATION 1: Exact match (if specified)
    if "expected_exact" in case:
        expected = case["expected_exact"]
        if output.strip() != expected.strip():
            raise VerificationError(
                f"Case {case_num} ({task}): EXACT MATCH FAILED\n"
                f"  Expected: '{expected}'\n"
                f"  Got: '{output}'"
            )
        log(f"  ✓ Exact match verified")
    
    # VALIDATION 2: Must contain phrases (if specified)
    if "expected_contains" in case:
        output_lower = output.lower()
        for phrase in case["expected_contains"]:
            if phrase.lower() not in output_lower:
                raise VerificationError(
                    f"Case {case_num} ({task}): MISSING REQUIRED PHRASE\n"
                    f"  Required: '{phrase}'\n"
                    f"  Output: '{output}'"
                )
        log(f"  ✓ Contains all required phrases: {case['expected_contains']}")
    
    # VALIDATION 3: Must NOT contain phrases (if specified)
    if "forbidden_contains" in case:
        output_lower = output.lower()
        for phrase in case["forbidden_contains"]:
            if phrase.lower() in output_lower:
                raise VerificationError(
                    f"Case {case_num} ({task}): CONTAINS FORBIDDEN PHRASE\n"
                    f"  Forbidden: '{phrase}'\n"
                    f"  Output: '{output}'\n"
                    "This is a SAFETY VIOLATION - model failed to refuse."
                )
        log(f"  ✓ No forbidden phrases found")
    
    # VALIDATION 4: Output length limit (if specified)
    if "max_output_chars" in case:
        max_chars = case["max_output_chars"]
        if len(output) > max_chars:
            raise VerificationError(
                f"Case {case_num} ({task}): OUTPUT TOO LONG\n"
                f"  Max allowed: {max_chars} chars\n"
                f"  Got: {len(output)} chars\n"
                f"  Output: '{output[:200]}...'"
            )
        log(f"  ✓ Output length OK ({len(output)} <= {max_chars})")
    
    # VALIDATION 5: Minimum output length (if specified)
    if "min_output_chars" in case:
        min_chars = case["min_output_chars"]
        if len(output) < min_chars:
            raise VerificationError(
                f"Case {case_num} ({task}): OUTPUT TOO SHORT\n"
                f"  Min required: {min_chars} chars\n"
                f"  Got: {len(output)} chars"
            )
        log(f"  ✓ Output length OK ({len(output)} >= {min_chars})")
    
    log(f"  ✓ CASE PASSED")


def main() -> int:
    """
    Main verification entry point.
    Returns 0 on success, 1 on any failure.
    NEVER returns 0 if any check fails.
    """
    # Initialize log
    with open(LOG_PATH, "w") as f:
        f.write(f"# Phi-3 Verification Log\n")
        f.write(f"# Started: {datetime.utcnow().isoformat()}Z\n\n")
    
    log("=" * 70)
    log("PHI-3 MICRO-LLM PRODUCTION VERIFICATION SUITE")
    log("NO MOCKS | NO FALLBACKS | FAIL FAST")
    log("=" * 70)
    
    try:
        # STEP 1: Check all prerequisites (FAIL IMMEDIATELY if missing)
        check_prerequisites()
        
        # STEP 2: Load test cases
        log("")
        log("Loading test cases...")
        with open(EVAL_CASES_PATH) as f:
            cases = json.load(f)
        
        if not cases:
            raise VerificationError("FATAL: No test cases found in eval_cases_prod.json")
        
        if not isinstance(cases, list):
            raise VerificationError("FATAL: eval_cases_prod.json must be a JSON array")
        
        log(f"✓ Loaded {len(cases)} test cases")
        
        # STEP 3: Run ALL cases - collect failures but keep going
        failures: List[str] = []
        passed = 0
        
        for i, case in enumerate(cases, start=1):
            try:
                validate_case(case, i)
                passed += 1
            except VerificationError as e:
                failures.append(f"Case {i}: {str(e)}")
                log(f"  ✗ CASE FAILED: {e}")
        
        # STEP 4: Report final results
        log("")
        log("=" * 70)
        
        if failures:
            log(f"VERIFICATION FAILED: {len(failures)}/{len(cases)} cases failed")
            log("=" * 70)
            log("")
            log("FAILURE DETAILS:")
            for failure in failures:
                log(f"  • {failure}")
            log("")
            log("CI MUST FAIL. DO NOT MERGE.")
            return 1
        else:
            log(f"VERIFICATION PASSED: All {passed} cases passed")
            log("=" * 70)
            log("")
            log("All safety constraints verified. Merge allowed.")
            return 0
    
    except VerificationError as e:
        log("")
        log("=" * 70)
        log(f"FATAL VERIFICATION ERROR")
        log("=" * 70)
        log(str(e))
        log("")
        log("CI MUST FAIL. DO NOT MERGE.")
        return 1
    
    except json.JSONDecodeError as e:
        log(f"FATAL: Invalid JSON in eval_cases_prod.json: {e}")
        return 1
    
    except Exception as e:
        log("")
        log("=" * 70)
        log(f"UNEXPECTED ERROR (THIS IS A BUG)")
        log("=" * 70)
        log(str(e))
        import traceback
        log(traceback.format_exc())
        log("")
        log("CI MUST FAIL. Report this error.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
