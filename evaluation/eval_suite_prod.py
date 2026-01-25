#!/usr/bin/env python3
"""
Production Evaluation Suite for Phi-3 Micro-LLM
NO MOCKS. NO FALLBACKS. FAIL FAST.

This suite runs real inference via llama.cpp and validates outputs.
Designed for CI execution on Linux.
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Paths (CI environment)
LLAMA_CPP_BINARY = Path("/opt/llama.cpp/main")
MODEL_PATH = Path("/opt/models/phi-3-mini-4k-instruct-q4.gguf")
EVAL_CASES_PATH = Path(__file__).parent / "eval_cases_prod.json"


class VerificationError(Exception):
    """Raised when verification fails"""
    pass


def check_prerequisites() -> None:
    """Verify all required binaries and models exist"""
    if not LLAMA_CPP_BINARY.exists():
        raise VerificationError(f"llama.cpp binary not found: {LLAMA_CPP_BINARY}")
    
    if not LLAMA_CPP_BINARY.is_file():
        raise VerificationError(f"llama.cpp binary is not a file: {LLAMA_CPP_BINARY}")
    
    if not MODEL_PATH.exists():
        raise VerificationError(f"Model file not found: {MODEL_PATH}")
    
    if not EVAL_CASES_PATH.exists():
        raise VerificationError(f"Eval cases not found: {EVAL_CASES_PATH}")
    
    print(f"✓ Prerequisites verified")
    print(f"  Binary: {LLAMA_CPP_BINARY}")
    print(f"  Model: {MODEL_PATH}")
    print(f"  Cases: {EVAL_CASES_PATH}")


def run_inference(prompt: str, max_tokens: int = 128) -> str:
    """
    Run real inference via llama.cpp
    NO MOCKS. NO FALLBACKS.
    """
    cmd = [
        str(LLAMA_CPP_BINARY),
        "-m", str(MODEL_PATH),
        "-p", prompt,
        "-n", str(max_tokens),
        "--temp", "0.0",  # Deterministic
        "--seed", "42",   # Reproducible
        "-c", "512",      # Context size
        "--log-disable"   # Reduce noise
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            check=True
        )
    except subprocess.TimeoutExpired:
        raise VerificationError(f"Inference timeout (30s) for prompt: {prompt[:50]}...")
    except subprocess.CalledProcessError as e:
        raise VerificationError(
            f"llama.cpp failed with exit code {e.returncode}\n"
            f"stderr: {e.stderr}\n"
            f"stdout: {e.stdout}"
        )
    
    if result.returncode != 0:
        raise VerificationError(f"Non-zero exit code: {result.returncode}")
    
    if not result.stdout:
        raise VerificationError("Empty stdout from llama.cpp")
    
    # Extract generated text (llama.cpp includes prompt in output)
    output = result.stdout.strip()
    
    # Remove prompt echo if present
    if prompt in output:
        output = output.replace(prompt, "", 1).strip()
    
    return output


def validate_case(case: Dict, case_num: int) -> None:
    """Validate a single test case"""
    task = case.get("task", "UNKNOWN")
    input_text = case.get("input", "")
    
    print(f"\n[Case {case_num}] {task}")
    print(f"  Input: {input_text[:60]}...")
    
    # Run inference
    output = run_inference(input_text)
    print(f"  Output: {output[:60]}...")
    
    # Validation checks
    if "expected_exact" in case:
        if output != case["expected_exact"]:
            raise VerificationError(
                f"Case {case_num}: Expected exact match\n"
                f"  Expected: {case['expected_exact']}\n"
                f"  Got: {output}"
            )
    
    if "expected_contains" in case:
        for phrase in case["expected_contains"]:
            if phrase.lower() not in output.lower():
                raise VerificationError(
                    f"Case {case_num}: Missing required phrase '{phrase}'\n"
                    f"  Output: {output}"
                )
    
    if "forbidden_contains" in case:
        for phrase in case["forbidden_contains"]:
            if phrase.lower() in output.lower():
                raise VerificationError(
                    f"Case {case_num}: Output contains forbidden phrase '{phrase}'\n"
                    f"  Output: {output}"
                )
    
    if "max_output_chars" in case:
        if len(output) > case["max_output_chars"]:
            raise VerificationError(
                f"Case {case_num}: Output too long ({len(output)} > {case['max_output_chars']})"
            )
    
    print(f"  ✓ PASS")


def main() -> int:
    """Main verification entry point"""
    print("=" * 60)
    print("Phi-3 Micro-LLM Production Verification Suite")
    print("=" * 60)
    
    try:
        # Step 1: Check prerequisites
        check_prerequisites()
        
        # Step 2: Load test cases
        with open(EVAL_CASES_PATH) as f:
            cases = json.load(f)
        
        if not cases:
            raise VerificationError("No test cases found")
        
        print(f"\n✓ Loaded {len(cases)} test cases")
        
        # Step 3: Run all cases
        failures = []
        for i, case in enumerate(cases, start=1):
            try:
                validate_case(case, i)
            except VerificationError as e:
                failures.append(str(e))
                print(f"  ✗ FAIL: {e}")
        
        # Step 4: Report results
        print("\n" + "=" * 60)
        if failures:
            print(f"VERIFICATION FAILED: {len(failures)}/{len(cases)} cases failed")
            print("=" * 60)
            for failure in failures:
                print(f"\n{failure}")
            return 1
        else:
            print(f"VERIFICATION PASSED: All {len(cases)} cases passed")
            print("=" * 60)
            return 0
    
    except VerificationError as e:
        print(f"\n✗ FATAL ERROR: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
