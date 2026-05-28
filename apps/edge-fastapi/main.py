import os
import uuid
import logging
import time
from typing import Dict, List, Optional
from enum import Enum
from fastapi import FastAPI, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import init_db, get_db, SessionLocal

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

# [MED-5] Startup assertion: actuator must have a key if enabled
if EDGE_EXECUTE_ENABLED and not EDGE_API_KEY:
    raise RuntimeError(
        "SECURITY ERROR: EDGE_EXECUTE_ENABLED is true but EDGE_API_KEY is not set. "
        "The browser actuator cannot run unauthenticated. Set EDGE_API_KEY or disable EDGE_EXECUTE_ENABLED."
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

# --- Schemas ---

class SanitizeRequest(BaseModel):
    text: str
    session_id: Optional[str] = None

class SanitizeResponse(BaseModel):
    sanitized_text: str
    token_map_id: str
    stats: Dict[str, int]

class CritiqueRequest(BaseModel):
    text: str
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
    prompt: str

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

# --- Endpoints ---

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
        local_intelligence.load_models()
        logger.info("Edge mode enabled.")
    else:
        logger.info("Edge mode disabled.")
    logger.info("Edge Node Startup Complete.")

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

@app.post("/v1/sanitize", response_model=SanitizeResponse)
def sanitize_text(request: SanitizeRequest):
    """Deep Tech: Semantic Masking with Metadata Injection"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    session_id = request.session_id or str(uuid.uuid4())
    sanitized_text, stats = local_intelligence.sanitize_and_tag(request.text, session_id)
    
    return {
        "sanitized_text": sanitized_text,
        "token_map_id": session_id,
        "stats": stats
    }

@app.post("/v1/critique", response_model=CritiqueResponse)
def critique_response(request: CritiqueRequest):
    """Deep Tech: Adversarial Judge"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    result = local_intelligence.critique_response(request.text)
    return {
        "status": result["status"],
        "score": result["score"],
        "reason": result.get("reason")
    }

@app.post("/v1/generate_offline", response_model=OfflineResponse)
def generate_offline(request: OfflineRequest):
    """Deep Tech: Offline Fallback (Quantized SLM)"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    output = local_intelligence.generate_offline(request.prompt)
    return {"text": output}

class ReidentifyRequest(BaseModel):
    token: str
    session_id: Optional[str] = None

@app.post("/v1/reidentify")
def reidentify_token(request: ReidentifyRequest):
    """Deep Tech: Protocol Break - Identity Vault Lookup"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    original = local_intelligence.reidentify_token(request.token, request.session_id)
    if not original:
        raise HTTPException(status_code=404, detail="Token not found or session mismatch")
    return {"original": original}

class ScoreRequest(BaseModel):
    text: str

class ScoreResponse(BaseModel):
    score: int

@app.post("/v1/score_intent", response_model=ScoreResponse)
def score_intent(request: ScoreRequest):
    """Deep Tech: Karmic Friction Analysis (Offline SLM)"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    score = local_intelligence.score_intent(request.text)
    return {"score": score}

# --- Legacy/Integration Endpoints (Search & Execute) ---

class SearchRequest(BaseModel):
    query: str
    limit: int = 5

class SearchResponse(BaseModel):
    results: List[Dict]

@app.post("/search", response_model=SearchResponse)
def search_golden_records(request: SearchRequest, db: Session = Depends(get_db)):
    """Semantic Search against Local Golden Records"""
    if not EDGE_MODE or not local_intelligence:
        raise HTTPException(status_code=503, detail="Edge features disabled")
    try:
        if not local_intelligence.embedding_model:
             local_intelligence.load_models()
        
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

@app.post("/execute")
def execute_browser_action(request: ExecuteRequest, x_api_key: str = Header(None)):
    """Secured Proxy for Browser Node (Puppeteer)"""
    if not EDGE_EXECUTE_ENABLED:
        raise HTTPException(status_code=403, detail="Edge execution is disabled")
    
    if EDGE_API_KEY and x_api_key != EDGE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    logger.info(f"PHYSICAL ACTUATOR: Executing {request.action} with {request.payload}")
    
    return {
        "status": "SUCCESS", 
        "message": f"Executed {request.action}",
        "hardware_ack": str(uuid.uuid4())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
