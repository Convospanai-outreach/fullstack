# app.py - FastAPI Application Entrypoint
from fastapi import FastAPI, Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid

# ==============================================================================
# 1. SETUP & AUTHENTICATION (RBAC)
# ==============================================================================

app = FastAPI(
    title="ConvoSpan Engine API",
    version="1.0.0",
    description="Sovereign AI API for multi-tenant enterprise orchestration"
)
security = HTTPBearer()

class Role(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    EDGE_NODE = "edge-node"
    AUDITOR = "auditor"

class User(BaseModel):
    user_id: str
    tenant_id: str
    roles: List[Role]
    industry: str

# Mock JWT Verification (In production, validate RS256 signature against JWKS)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> User:
    token = credentials.credentials
    if token == "mock_admin_token":
        return User(user_id="u1", tenant_id="t1", roles=[Role.ADMIN, Role.ANALYST], industry="healthcare")
    elif token == "mock_analyst_token":
        return User(user_id="u2", tenant_id="t1", roles=[Role.ANALYST], industry="healthcare")
    elif token == "mock_auditor_token":
        return User(user_id="u3", tenant_id="t1", roles=[Role.AUDITOR], industry="manufacturing")
    elif token == "mock_edge_token":
        return User(user_id="n1", tenant_id="t1", roles=[Role.EDGE_NODE], industry="bfsi")
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def require_role(allowed_roles: List[Role]):
    def role_checker(user: User = Depends(get_current_user)):
        if not any(role in user.roles for role in allowed_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return role_checker

# ==============================================================================
# 2. CAMPAIGN MANAGEMENT API
# ==============================================================================

class CampaignCreate(BaseModel):
    name: str
    playbook_id: Optional[uuid.UUID] = None

class CampaignResponse(CampaignCreate):
    id: uuid.UUID
    status: str

@app.post("/api/v1/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign: CampaignCreate,
    user: User = Depends(require_role([Role.ADMIN, Role.ANALYST]))
):
    # Mock DB insertion
    return CampaignResponse(id=uuid.uuid4(), status="draft", **campaign.dict())

@app.get("/api/v1/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    user: User = Depends(require_role([Role.ADMIN, Role.ANALYST, Role.AUDITOR]))
):
    # Mock DB retrieval
    return CampaignResponse(id=campaign_id, name="Q3 Outreach", status="active")

# ==============================================================================
# 3. PLAYBOOK API
# ==============================================================================

class PlaybookGenerateRequest(BaseModel):
    name: str
    target_audience_summary: str
    campaign_goal: str

class PlaybookResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str = "generating"

@app.post("/api/v1/playbooks/generate", response_model=PlaybookResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_playbook(
    req: PlaybookGenerateRequest,
    user: User = Depends(require_role([Role.ADMIN, Role.ANALYST]))
):
    # Here we would dispatch to the Redis Task Queue for the PlaybookGeneratorAgent
    return PlaybookResponse(id=uuid.uuid4(), name=req.name)

@app.get("/api/v1/playbooks/{playbook_id}")
async def get_playbook(
    playbook_id: uuid.UUID,
    user: User = Depends(require_role([Role.ADMIN, Role.ANALYST, Role.AUDITOR]))
):
    return {"id": playbook_id, "name": "Enterprise Renewal Sequence", "steps": []}

# ==============================================================================
# 4. INTELLIGENCE & DRIFT API
# ==============================================================================

@app.get("/api/v1/intelligence/leads/{lead_hash_id}")
async def get_lead_intelligence(
    lead_hash_id: str,
    user: User = Depends(require_role([Role.ADMIN, Role.ANALYST, Role.EDGE_NODE]))
):
    # Returns PII-free intelligence data
    return {"lead_hash_id": lead_hash_id, "sentiment_score": 0.85, "engagement_level": "high"}

@app.get("/api/v1/drift/campaigns/{campaign_id}")
async def check_drift(
    campaign_id: uuid.UUID,
    user: User = Depends(require_role([Role.ADMIN, Role.ANALYST, Role.AUDITOR]))
):
    return {"campaign_id": campaign_id, "drift_detected": False, "severity": "low"}

@app.get("/api/v1/audit/logs")
async def get_audit_trail(
    limit: int = 50,
    user: User = Depends(require_role([Role.ADMIN, Role.AUDITOR]))
):
    return [{"event": "playbook_generated", "agent_id": "PlaybookGenerator", "timestamp": "2026-03-01T00:00:00Z"}]

# ==============================================================================
# 5. LLM GATEWAY API (Sovereign Routing & PII Stripping)
# ==============================================================================

class LLMRequest(BaseModel):
    prompt: str
    context: Dict[str, Any] = Field(default_factory=dict)
    temperature: float = 0.7

def apply_pii_stripping(text: str) -> str:
    """Mock PII scrubbing logic. In production, this calls the PIIExtractorAgent (Local Micro-LLM)."""
    # Simply replacing a known pattern for demonstration
    sensitive_words = ["John Doe", "jane@example.com", "+1-555-0100"]
    scrubbed = text
    for word in sensitive_words:
        scrubbed = scrubbed.replace(word, "[REDACTED]")
    return scrubbed

def route_llm_request(industry: str, payload: dict) -> dict:
    """
    Industry-specific provider routing. Maps requests based on contractual/compliance needs.
    """
    routing_map = {
        "manufacturing": "gemini-2.0-flash",
        "healthcare": "claude-3.5-sonnet", # Example of strict healthcare compliance routing
        "bfsi": "gemini-2.0-pro",
        "default": "gemini-2.0-flash"
    }
    target_model = routing_map.get(industry, routing_map["default"])
    
    # Mock sending to external provider
    return {
        "model_used": target_model,
        "response": f"Mock response generated by {target_model} based on prompt: {payload['prompt'][:20]}...",
        "pii_scrubbed": True
    }

@app.post("/api/v1/llm/generate")
async def llm_generate(
    req: LLMRequest,
    user: User = Depends(require_role([Role.EDGE_NODE, Role.ADMIN])) # Only Edge Node or Admin should trigger raw LLM
):
    anonymized_prompt = apply_pii_stripping(req.prompt)
    result = route_llm_request(user.industry, {"prompt": anonymized_prompt})
    return result

@app.post("/api/v1/llm/critique")
async def llm_critique(
    req: LLMRequest,
    user: User = Depends(require_role([Role.EDGE_NODE]))
):
    anonymized_prompt = apply_pii_stripping(req.prompt)
    result = route_llm_request(user.industry, {"prompt": f"Critique the following: {anonymized_prompt}"})
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
