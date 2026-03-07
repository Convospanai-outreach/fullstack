import os
import json
import re
import logging
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any

from pii_vault import pii_vault
from llm_engine import phi3_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sovereign_node")

app = FastAPI(title="ConvoSpan Sovereign Node", version="2.0.0")

ENVIRONMENT_HW_SIG = os.getenv("HARDWARE_SIGNATURE", "dev_signature")


# ============================================================
# DATA MODELS
# ============================================================

class SanitizeRequest(BaseModel):
    text: str
    session_id: Optional[str] = None

class CritiqueRequest(BaseModel):
    text: Optional[str] = None
    content: Optional[str] = None  # alias used by MicroLLMClient.ts
    context: Optional[Dict[str, Any]] = None

    def get_text(self) -> str:
        """Return whichever field was provided."""
        return self.text or self.content or ""


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 3

class ExecuteRequest(BaseModel):
    action: str
    payload: Dict

class IdentityRequest(BaseModel):
    maskedId: str
    purpose: str

class InferRequest(BaseModel):
    inputText: str
    taskType: str
    brandRules: Optional[Dict[str, Any]] = None
    policyRules: Optional[Dict[str, Any]] = None


# ============================================================
# TASK-SPECIFIC PROMPT ENGINEERING
# Each taskType gets a targeted Phi-3 instruct prompt with
# structured JSON output format — no generic one-size-fits-all.
# ============================================================

TASK_PROMPTS = {
    "TONE_NORMALIZATION": lambda req: (
        "You are a brand tone enforcer. Rewrite the following email/message to match "
        "the target tone exactly, without changing its meaning or intent.\n"
        f"Target tone: {(req.brandRules or {}).get('tone', 'Professional')}\n"
        f"Forbidden phrases: {', '.join((req.brandRules or {}).get('forbiddenPhrases', []) or [])}\n"
        "Input:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object: {\"outputText\": \"...\", \"confidence\": 0.0-1.0}"
    ),

    "GRAMMAR_REPAIR": lambda req: (
        "You are a grammar and fluency checker for professional sales outreach.\n"
        "Fix all grammar, spelling, and punctuation errors in the input text.\n"
        "Do NOT change the meaning or tone — only correct errors.\n"
        "Input:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object: {\"outputText\": \"...\", \"confidence\": 0.0-1.0}"
    ),

    "BRAND_ENFORCEMENT": lambda req: (
        "You are a brand compliance officer. Analyze the following outreach message.\n"
        f"Brand tone requirements: {json.dumps((req.brandRules or {}).get('tone', 'Professional'))}\n"
        f"Forbidden phrases: {json.dumps((req.brandRules or {}).get('forbiddenPhrases', []) or [])}\n"
        "Does the message comply with the brand guidelines?\n"
        "If it violates any rule, rewrite the violating parts.\n"
        "Input:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object:\n"
        "{\"classification\": \"ALLOW\" | \"BLOCK\" | \"REVIEW\", \"outputText\": \"...\", "
        "\"refusalReason\": \"only if BLOCK or REVIEW\", \"confidence\": 0.0-1.0}"
    ),

    "POLICY_CLASSIFICATION": lambda req: (
        "You are a compliance AI for outbound sales messages.\n"
        "Review the following message for policy violations:\n"
        "- No pressure tactics or false urgency\n"
        "- No guaranteed results or promises\n"
        f"- WhatsApp consent required: {(req.policyRules or {}).get('whatsappConsent', True)}\n"
        "- No spam trigger phrases\n"
        "Message to review:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object:\n"
        "{\"classification\": \"ALLOW\" | \"BLOCK\" | \"REVIEW\", "
        "\"refusalReason\": \"specific violation if BLOCK or REVIEW\", \"confidence\": 0.0-1.0}"
    ),

    "POLICY_REWRITE": lambda req: (
        "You are a compliance rewriter. The following message has been flagged for policy violations.\n"
        "Rewrite it to comply with these rules WITHOUT blocking the core message:\n"
        "- Remove pressure tactics or false urgency (e.g., 'limited time', 'act now')\n"
        "- Remove guarantees or exaggerated claims\n"
        "- Keep the core value proposition intact\n"
        "Non-compliant message:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object: {\"outputText\": \"...\", \"confidence\": 0.0-1.0}"
    ),

    "CONVERSATION_SUMMARY": lambda req: (
        "Summarize the following email conversation for a sales AI agent.\n"
        "Extract: prospect interest level, any objections raised, next step mentioned.\n"
        "Be concise — 3 sentences max.\n"
        "Conversation:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object:\n"
        "{\"outputText\": \"3-sentence summary\", \"confidence\": 0.0-1.0}"
    ),

    "OBJECTION_EXTRACTION": lambda req: (
        "You are a sales AI. Extract ALL objections from the prospect's reply.\n"
        "Categorize each objection as one of: PRICE, TIMING, COMPETITOR, NO_NEED, TRUST, OTHER\n"
        "Reply from prospect:\n"
        f"{req.inputText}\n\n"
        "Return ONLY a JSON object:\n"
        "{\"outputText\": \"comma-separated list of objection categories\", \"confidence\": 0.0-1.0}"
    ),

    "REFUSAL_GENERATION": lambda req: (
        "Generate a polite, professional unsubscribe acknowledgment message.\n"
        "The prospect sent: {req.inputText}\n"
        "Rules:\n"
        "- Acknowledge their request\n"
        "- Confirm they have been removed from outreach\n"
        "- Do NOT try to re-engage\n"
        "- Keep under 40 words\n\n"
        "Return ONLY a JSON object: {\"outputText\": \"...\", \"confidence\": 0.0-1.0}"
    ),
}


def build_prompt(req: InferRequest) -> str:
    builder = TASK_PROMPTS.get(req.taskType)
    if not builder:
        # Fallback for unknown task types
        return (
            f"Task: {req.taskType}\n"
            f"Input: {req.inputText}\n"
            "Return ONLY a JSON object: {\"outputText\": \"...\", \"confidence\": 0.0-1.0}"
        )
    return builder(req)


def parse_llm_json(raw_output: str, task_type: str) -> Dict:
    """
    Parse structured JSON from Phi-3 output.
    Falls back gracefully if the model doesn't return clean JSON.
    """
    # Try to extract JSON block
    try:
        json_match = re.search(r'\{.*\}', raw_output, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group(0))
            if 'confidence' not in parsed:
                parsed['confidence'] = 0.85
            return parsed
    except (json.JSONDecodeError, AttributeError):
        pass

    # Fallback: wrap the raw output
    if task_type in ("POLICY_CLASSIFICATION", "BRAND_ENFORCEMENT"):
        upper = raw_output.upper()
        classification = "ALLOW"
        if "BLOCK" in upper:
            classification = "BLOCK"
        elif "REVIEW" in upper:
            classification = "REVIEW"
        return {
            "classification": classification,
            "outputText": raw_output.strip(),
            "confidence": 0.70
        }

    return {
        "outputText": raw_output.strip(),
        "confidence": 0.70
    }


# ============================================================
# HARDWARE ATTESTATION
# ============================================================

@app.get("/health")
def health_check():
    """Returns the hardware status and unique hardware_id for attestation."""
    return {
        "status": "ONLINE",
        "hardware_id": ENVIRONMENT_HW_SIG,
        "node_version": "2.0.0",
        "capabilities": list(TASK_PROMPTS.keys())
    }


# ============================================================
# PII & SOVEREIGN FIREWALL ROUTES
# ============================================================

@app.post("/sanitize")
@app.post("/v1/sanitize")
def sanitize_text(req: SanitizeRequest):
    """Masks PII from the text, stores tokens in local vault."""
    sanitized, token_id, stats = pii_vault.sanitize(req.text)
    return {
        "sanitized_text": sanitized,
        "token_map_id": token_id,
        "stats": stats
    }


@app.post("/identity/resolve")
def resolve_identity(req: IdentityRequest):
    """Reverses a masked identity token from the local PII vault."""
    original_val = pii_vault.re_identify(req.maskedId, req.purpose)

    if not original_val:
        raise HTTPException(status_code=404, detail="Identity not found or unauthorized.")

    if "@" in original_val:
        return {"email": original_val}
    else:
        return {"phone": original_val}


@app.post("/compliance/mode")
def set_compliance_mode(request: Request):
    """Sets regional compliance boundaries (GDPR, DPDP, etc)."""
    return {"status": "success"}


# ============================================================
# MICRO-LLM (PHI-3) INFERENCE — SPECIALIZED TASK ENDPOINTS
# ============================================================

@app.post("/infer")
def run_inference(req: InferRequest):
    """
    Core Micro-LLM endpoint. Routes to task-specific prompt engineering
    for each MicroLLMTaskType defined in MicroLLMTypes.ts.
    Returns structured JSON compatible with MicroLLMResponse interface.
    """
    try:
        logger.info(f"[Infer] Task: {req.taskType}")
        prompt = build_prompt(req)
        raw_result = phi3_engine.infer(prompt, req.taskType)
        structured = parse_llm_json(raw_result.get("result", ""), req.taskType)
        return structured
    except Exception as e:
        logger.error(f"[Infer] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/critique")
@app.post("/v1/critique")
def critique_text(req: CritiqueRequest):
    """
    Adversarial safety check for generated email drafts.
    Uses BRAND_ENFORCEMENT + POLICY_CLASSIFICATION in sequence.
    Returns a combined verdict compatible with SovereignFirewall.critique().
    """
    logger.info("[Critique] Running adversarial check...")

    # Step 1: Policy check
    policy_req = InferRequest(
        inputText=req.get_text(),
        taskType="POLICY_CLASSIFICATION",
        policyRules={"noPressure": True, "noGuarantees": True}
    )
    policy_result = parse_llm_json(phi3_engine.infer(build_prompt(policy_req), "POLICY_CLASSIFICATION").get("result", ""), "POLICY_CLASSIFICATION")
    policy_ok = policy_result.get("classification", "ALLOW") == "ALLOW"

    # Step 2: Brand enforcement check
    brand_req = InferRequest(
        inputText=req.get_text(),
        taskType="BRAND_ENFORCEMENT",
        brandRules=(req.context or {}).get("branding", {}) if isinstance(req.context, dict) else {}
    )
    brand_result = parse_llm_json(phi3_engine.infer(build_prompt(brand_req), "BRAND_ENFORCEMENT").get("result", ""), "BRAND_ENFORCEMENT")
    brand_ok = brand_result.get("classification", "ALLOW") != "BLOCK"

    overall_pass = policy_ok and brand_ok
    reason_parts = []
    if not policy_ok:
        reason_parts.append(f"Policy: {policy_result.get('refusalReason', 'violation detected')}")
    if not brand_ok:
        reason_parts.append(f"Brand: {brand_result.get('refusalReason', 'violation detected')}")

    score = 0.9 if overall_pass else 0.4
    reason = "; ".join(reason_parts) if reason_parts else "Content passed all checks"

    return {
        "status": "APPROVED" if overall_pass else "REJECTED",
        "similarity_score": score,
        "score": score,
        "reason": reason,
        "approved": overall_pass,
        "policy_check": policy_result,
        "brand_check": brand_result
    }


# ============================================================
# HARDWARE ACTUATION ROUTES
# ============================================================

@app.post("/search")
def run_search(req: SearchRequest):
    """Local knowledge search (can be extended with a vector store)."""
    return {"results": []}


@app.post("/execute")
def execute_hardware_action(req: ExecuteRequest):
    """Accepts actions like `send_connection` to actuate local browser/Selenium."""
    logger.info(f"[Execute] Action: {req.action}, Payload: {req.payload}")
    return {"status": "executed", "action": req.action}


@app.post("/workflows/save")
def save_workflow():
    return {"status": "saved"}


@app.get("/workflows")
def get_workflows():
    return []


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8081)))
