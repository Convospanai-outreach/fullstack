"""
External Node Simulation Script
--------------------------------
Runs the ConvoSpan Sovereign Node locally in MOCK mode (no real Phi-3 model needed).
All LLM responses are structured mocks — valid JSON compatible with MicroLLMClient.ts.

Usage:
    uv run simulate_node.py
"""
import subprocess
import sys
import os

# Check FastAPI is installed
try:
    import fastapi
    import uvicorn
except ImportError:
    print("[Simulator] Installing deps via pip...")
    subprocess.check_call([sys.executable, "-m", "pip", "install",
        "fastapi==0.111.0", "uvicorn==0.29.0", "pydantic==2.7.1", "python-dotenv==1.0.1"])

# Set env — forces MOCK mode (no model download needed)
os.environ.setdefault("HARDWARE_SIGNATURE", "LOCAL_DEV_SIM_001")
os.environ.setdefault("EDGE_NODE_URL", "http://localhost:8081")
# MODEL_PATH left unset so llm_engine falls back to MOCK automatically

print("=" * 60)
print("  ConvoSpan Sovereign Node — LOCAL SIMULATION MODE")
print("  Phi-3 LLM: MOCK (no model download required)")
print("  PII Vault: In-memory")
print("  Port: 8081")
print("=" * 60)
print()

# Start the FastAPI app
import uvicorn
uvicorn.run("main:app", host="0.0.0.0", port=8081, log_level="info", reload=False)
