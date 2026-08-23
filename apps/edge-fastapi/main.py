import os
import uuid
import logging
import time
import hmac
from typing import Any, Dict, List, Optional
from enum import Enum
from fastapi import FastAPI, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from database import init_db, get_db, SessionLocal, WorkflowRecord, EdgeSetting, EdgeActivityLog

# Logging
import contextvars
from starlette.middleware.base import BaseHTTPMiddleware

CORRELATION_ID_CTX = contextvars.ContextVar("correlation_id", default=None)

class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        correlation_id = request.headers.get("x-correlation-id", str(uuid.uuid4()))
        token = CORRELATION_ID_CTX.set(correlation_id)
        try:
            response = await call_next(request)
            response.headers["x-correlation-id"] = correlation_id
            return response
        finally:
            CORRELATION_ID_CTX.reset(token)

EDGE_MODE = os.getenv("EDGE_MODE", "disabled").lower() in {"1", "true", "edge", "enabled"}
EDGE_EXECUTE_ENABLED = os.getenv("EDGE_EXECUTE_ENABLED", "false").lower() == "true"
EDGE_API_KEY = os.getenv("EDGE_API_KEY")
EDGE_REQUIRE_API_KEY = os.getenv("EDGE_REQUIRE_API_KEY", "true").lower() == "true"
EDGE_REQUIRE_VAULT_KEY = os.getenv("EDGE_REQUIRE_VAULT_KEY", "true").lower() == "true"
MAX_TEXT_CHARS = int(os.getenv("EDGE_MAX_TEXT_CHARS", "12000"))

# [MED-5] Startup assertion: actuator must have a key if enabled
if EDGE_EXECUTE_ENABLED and not EDGE_API_KEY:
    raise RuntimeError(
        "SECURITY ERROR: EDGE_EXECUTE_ENABLED is true but EDGE_API_KEY is not set. "
        "The browser actuator cannot run unauthenticated. Set EDGE_API_KEY or disable EDGE_EXECUTE_ENABLED."
    )

if EDGE_MODE and EDGE_REQUIRE_API_KEY and not EDGE_API_KEY:
    raise RuntimeError(
        "SECURITY ERROR: EDGE_MODE is enabled but EDGE_API_KEY is not set. "
        "Set EDGE_API_KEY or explicitly set EDGE_REQUIRE_API_KEY=false for a local-only lab run."
    )

if EDGE_MODE and EDGE_REQUIRE_VAULT_KEY and not os.getenv("EDGE_VAULT_KEY"):
    raise RuntimeError(
        "SECURITY ERROR: EDGE_MODE is enabled but EDGE_VAULT_KEY is not set. "
        "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )

app = FastAPI(title="CraftMyFunnel Edge Node")
app.add_middleware(CorrelationMiddleware)

# Inject correlation ID into logs
class CorrelationLogFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = CORRELATION_ID_CTX.get()
        return True

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - [%(correlation_id)s] - %(levelname)s - %(message)s'
)
for handler in logging.root.handlers:
    handler.addFilter(CorrelationLogFilter())

logger = logging.getLogger(__name__)

# Hardware Signature
HARDWARE_SIGNATURE = os.getenv("HARDWARE_SIGNATURE", "unix-default-sig")

local_intelligence = None
if EDGE_MODE:
    from services.local_intelligence import LocalIntelligenceService
    local_intelligence = LocalIntelligenceService(SessionLocal)

# Optional cloud heartbeat: lets the dashboard show this node as connected.
# Entirely opt-in - only runs when EDGE_CLOUD_API_URL is set, so teams who
# haven't bought/paired a physical node are completely unaffected. Pairing
# itself (giving the cloud this node's public key) is a one-time admin step
# in the dashboard; this only sends the recurring "still alive" signal.
cloud_registration_client = None
if os.getenv("EDGE_CLOUD_API_URL", "").strip():
    from services.cloud_registration import build_client_from_env
    cloud_registration_client = build_client_from_env(SessionLocal, HARDWARE_SIGNATURE)

# --- Schemas ---

class SanitizeRequest(BaseModel):
    text: str = Field(min_length=1)
    session_id: Optional[str] = None

class SanitizeResponse(BaseModel):
    sanitized_text: str
    token_map_id: str
    stats: Dict[str, int]

class CritiqueRequest(BaseModel):
    text: str = Field(min_length=1)
    context: Optional[str] = None

class CritiqueResponse(BaseModel):
    status: str # APPROVED, REJECTED, ERROR
    score: float # Similarity Score
    reason: Optional[str] = None

class StatusResponse(BaseModel):
    status: str
    hardware_id: str
    services: List[str]

class OfflineRequest(BaseModel):
    prompt: str = Field(min_length=1)

class OfflineResponse(BaseModel):
    text: str

class BrowserAction(str, Enum):
    NAVIGATE = "NAVIGATE"
    CLICK = "CLICK"
    TYPE = "TYPE"
    SCROLL = "SCROLL"
    EXTRACT = "EXTRACT"

class ExecuteRequest(BaseModel):
    action: BrowserAction
    payload: Dict

class WorkflowPayload(BaseModel):
    id: Optional[str] = None
    name: str
    steps: List[Dict[str, Any]]
    teamId: str

class WorkflowSaveRequest(BaseModel):
    workflow: WorkflowPayload

class ComplianceModeRequest(BaseModel):
    region: str

# --- Endpoints ---

def require_edge_api_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    if not EDGE_API_KEY:
        if EDGE_REQUIRE_API_KEY and EDGE_MODE:
            raise HTTPException(status_code=503, detail="EDGE_API_KEY is not configured")
        return

    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:]

    presented = x_api_key or bearer
    if not presented or not hmac.compare_digest(presented, EDGE_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


def enforce_text_limit(value: str):
    if len(value) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Text exceeds EDGE_MAX_TEXT_CHARS ({MAX_TEXT_CHARS})",
        )

def init_db_with_retry(retries=5, delay=3):
    for attempt in range(retries):
        try:
            init_db()
            return
        except Exception as e:
            logger.warning(f"DB init attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
    raise RuntimeError("Failed to initialize database after multiple attempts")

@app.on_event("startup")
def startup_event():
    logger.info("Initializing Edge Database...")
    init_db_with_retry()
    if EDGE_MODE and local_intelligence:
        local_intelligence.warmup(os.getenv("EDGE_PRELOAD_MODELS", "none").lower())
        logger.info("Edge mode enabled.")
    else:
        logger.info("Edge mode disabled.")
    if cloud_registration_client:
        logger.info(
            f"Cloud connectivity enabled. If not yet paired, pair from the dashboard with "
            f"fingerprint={HARDWARE_SIGNATURE} and publicKey below:\n{cloud_registration_client.public_key_pem()}"
        )
        cloud_registration_client.start()
    else:
        logger.info("Cloud connectivity disabled (EDGE_CLOUD_API_URL not set) - optional service, not required.")
    logger.info("Edge Node Startup Complete.")

@app.on_event("shutdown")
def shutdown_event():
    if cloud_registration_client:
        cloud_registration_client.stop()

@app.get("/health", response_model=StatusResponse)
def health_check():
    """Hardware Handshake Endpoint"""
    if not HARDWARE_SIGNATURE:
        raise HTTPException(status_code=503, detail="Hardware ID missing")
    services = ["runtime"]
    if EDGE_MODE:
        services.extend(["local_intelligence", "vector-db", "offline-llm"])
    return {
        "status": "ONLINE",
        "hardware_id": HARDWARE_SIGNATURE,
        "services": services
    }

VERSION = os.getenv("APP_VERSION", "1.0.0")

@app.get("/version")
def version():
    return {"version": VERSION}

@app.get("/capabilities")
def capabilities():
    return {
        "capabilities": {
            "tokenize": bool(EDGE_MODE),
            "classify": bool(EDGE_MODE),
            "generate": bool(EDGE_MODE),
            "execute": bool(EDGE_EXECUTE_ENABLED)
        }
    }

@app.post("/v1/sanitize", response_model=SanitizeResponse, dependencies=[Depends(require_edge_api_key)])
def sanitize_text(request: SanitizeRequest):
    """Deep Tech: Semantic Masking with Metadata Injection"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    enforce_text_limit(request.text)
    session_id = request.session_id or str(uuid.uuid4())
    sanitized_text, stats = local_intelligence.sanitize_and_tag(request.text, session_id)
    
    return {
        "sanitized_text": sanitized_text,
        "token_map_id": session_id,
        "stats": stats
    }

@app.post("/v1/critique", response_model=CritiqueResponse, dependencies=[Depends(require_edge_api_key)])
def critique_response(request: CritiqueRequest):
    """Deep Tech: Adversarial Judge"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    enforce_text_limit(request.text)
    result = local_intelligence.critique_response(request.text)
    return {
        "status": result["status"],
        "score": result["score"],
        "reason": result.get("reason")
    }

@app.post("/v1/generate_offline", response_model=OfflineResponse, dependencies=[Depends(require_edge_api_key)])
def generate_offline(request: OfflineRequest):
    """Deep Tech: Offline Fallback (Quantized SLM)"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    enforce_text_limit(request.prompt)
    output = local_intelligence.generate_offline(request.prompt)
    return {"text": output}

class ReidentifyRequest(BaseModel):
    token: str
    session_id: Optional[str] = None

@app.post("/v1/reidentify", dependencies=[Depends(require_edge_api_key)])
def reidentify_token(request: ReidentifyRequest):
    """Deep Tech: Protocol Break - Identity Vault Lookup"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    original = local_intelligence.reidentify_token(request.token, request.session_id)
    if not original:
        raise HTTPException(status_code=404, detail="Token not found or session mismatch")
    return {"original": original}

class ScoreRequest(BaseModel):
    text: str = Field(min_length=1)

class ScoreResponse(BaseModel):
    score: int

@app.post("/v1/score_intent", response_model=ScoreResponse, dependencies=[Depends(require_edge_api_key)])
def score_intent(request: ScoreRequest):
    """Deep Tech: Karmic Friction Analysis (Offline SLM)"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    enforce_text_limit(request.text)
    score = local_intelligence.score_intent(request.text)
    return {"score": score}

# --- Legacy/Integration Endpoints (Search & Execute) ---

class SearchRequest(BaseModel):
    query: str
    limit: int = Field(default=5, ge=1, le=25)

class SearchResponse(BaseModel):
    results: List[Dict]

@app.post("/search", response_model=SearchResponse, dependencies=[Depends(require_edge_api_key)])
def search_golden_records(request: SearchRequest, db: Session = Depends(get_db)):
    """Semantic Search against Local Golden Records"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    try:
        if not local_intelligence.embedding_model:
             local_intelligence.load_embedding_model()
        
        vector = local_intelligence.embedding_model.encode(request.query).tolist()
        vector_str = str(vector)
        
        sql = text("SELECT response_text, quality_score, 1 - (embedding <=> :vector) as similarity FROM golden_records ORDER BY embedding <=> :vector LIMIT :limit")
        rows = db.execute(sql, {"vector": vector_str, "limit": request.limit}).fetchall()
        
        results = []
        for row in rows:
            results.append({
                "content": row.response_text,
                "score": float(row.similarity),
                "metadata": {"quality": row.quality_score}
            })
            
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return {"results": []}

@app.post("/workflows/save", dependencies=[Depends(require_edge_api_key)])
def save_workflow(request: WorkflowSaveRequest, db: Session = Depends(get_db)):
    """Sovereign Edge Storage: Persist a workflow definition"""
    workflow = request.workflow
    workflow_id = workflow.id or str(uuid.uuid4())

    existing = db.query(WorkflowRecord).filter(WorkflowRecord.id == workflow_id).first()
    if existing:
        existing.name = workflow.name
        existing.steps = workflow.steps
        existing.team_id = workflow.teamId
    else:
        db.add(WorkflowRecord(
            id=workflow_id,
            name=workflow.name,
            steps=workflow.steps,
            team_id=workflow.teamId
        ))

    db.commit()
    return {"status": "saved", "id": workflow_id}

@app.get("/workflows", dependencies=[Depends(require_edge_api_key)])
def list_workflows(db: Session = Depends(get_db)):
    """Sovereign Edge Storage: List persisted workflow definitions.

    Not filtered by team_id: this endpoint is scoped by the single shared
    EDGE_API_KEY for the physical edge device, which is the trust boundary
    here (one hardware node, called server-to-server by apps/api). team_id
    is provenance metadata, not an access control dimension.
    """
    records = db.query(WorkflowRecord).order_by(WorkflowRecord.created_at.desc()).all()
    return [
        {
            "id": record.id,
            "name": record.name,
            "steps": record.steps,
            "teamId": record.team_id,
            "createdAt": record.created_at.isoformat()
        }
        for record in records
    ]

@app.get("/activity", dependencies=[Depends(require_edge_api_key)])
def list_activity(limit: int = 50, db: Session = Depends(get_db)):
    """Recent node activity: what function ran, entity types/counts touched,
    when. Never returns plaintext PII - only metadata about what was done.
    Backs the dashboard's edge-node status feed."""
    limit = min(max(limit, 1), 200)
    records = db.query(EdgeActivityLog).order_by(EdgeActivityLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": record.id,
            "function": record.function,
            "entityTypes": record.entity_types,
            "entityCount": record.entity_count,
            "sessionId": record.session_id,
            "createdAt": record.created_at.isoformat(),
        }
        for record in records
    ]

@app.post("/compliance/mode", dependencies=[Depends(require_edge_api_key)])
def set_compliance_mode(request: ComplianceModeRequest, db: Session = Depends(get_db)):
    """Region Compliance: Persist the active data-residency mode"""
    region = request.region.strip().upper()
    if region not in {"INDIA", "EU"}:
        raise HTTPException(status_code=400, detail="Invalid region. Use INDIA or EU.")

    existing = db.query(EdgeSetting).filter(EdgeSetting.key == "compliance_mode").first()
    if existing:
        existing.value = region
    else:
        db.add(EdgeSetting(key="compliance_mode", value=region))

    db.commit()
    return {"status": "ok", "region": region}

@app.post("/execute", dependencies=[Depends(require_edge_api_key)])
def execute_browser_action(request: ExecuteRequest):
    """STUB: does not yet drive the Browser Node (Puppeteer). Logs and
    acknowledges the request only - no browser action is actually performed.
    See OPEN_ITEMS.md for tracking."""
    if not EDGE_EXECUTE_ENABLED:
        raise HTTPException(status_code=403, detail="Edge execution is disabled")

    logger.info(f"PHYSICAL ACTUATOR (STUB, NOT WIRED): Would execute {request.action} with {request.payload}")

    return {
        "status": "SUCCESS",
        "message": f"Stub-executed {request.action} (no real browser action performed)",
        "hardware_ack": str(uuid.uuid4())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
