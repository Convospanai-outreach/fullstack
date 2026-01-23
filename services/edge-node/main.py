import os
import uuid
import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import init_db, get_db, SessionLocal
from services.local_intelligence import LocalIntelligenceService

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ConvoSpan Edge Node")

# Hardware Signature
HARDWARE_SIGNATURE = os.getenv("HARDWARE_SIGNATURE", "unix-default-sig")

# Initialize Service
# Pass session factory (get_db is a generator, so we need a way to create sessions inside service)
# For simplicity in this FastApi app, we'll let the endpoints pass the db session to the service methods usually,
# OR we pass the SessionLocal factory. Let's pass the factory from database.py if we can import it.
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

# --- Endpoints ---

@app.on_event("startup")
def startup_event():
    logger.info("Initializing Edge Database...")
    init_db()
    # Pre-load models (Lazy load trigger)
    local_intelligence.load_models()
    logger.info("Edge Node Startup Complete.")

@app.get("/health", response_model=StatusResponse)
def health_check():
    """Hardware Handshake Endpoint"""
    if not HARDWARE_SIGNATURE:
        raise HTTPException(status_code=503, detail="Hardware ID missing")
    return {
        "status": "ONLINE",
        "hardware_id": HARDWARE_SIGNATURE,
        "services": ["local_intelligence", "vector-db", "offline-llm"]
    }

@app.post("/sanitize", response_model=SanitizeResponse)
def sanitize_text(request: SanitizeRequest):
    """Deep Tech: Semantic Masking with Metadata Injection"""
    session_id = request.session_id or str(uuid.uuid4())
    sanitized_text, stats = local_intelligence.sanitize_and_tag(request.text, session_id)
    
    return {
        "sanitized_text": sanitized_text,
        "token_map_id": session_id,
        "stats": stats
    }

@app.post("/critique", response_model=CritiqueResponse)
def critique_response(request: CritiqueRequest):
    """Deep Tech: Adversarial Judge"""
    result = local_intelligence.critique_response(request.text)
    return {
        "status": result["status"],
        "score": result["score"],
        "reason": result.get("reason")
    }

@app.post("/generate_offline", response_model=OfflineResponse)
def generate_offline(request: OfflineRequest):
    """Deep Tech: Offline Fallback (Quantized SLM)"""
    output = local_intelligence.generate_offline(request.prompt)
    return {"text": output}

# --- Legacy/Integration Endpoints (Search & Execute) ---
# Keeping these inline or moving to service? Moving search to service makes sense but preserving logic for now.

class SearchRequest(BaseModel):
    query: str
    limit: int = 5

class SearchResponse(BaseModel):
    results: List[Dict]

@app.post("/search", response_model=SearchResponse)
def search_golden_records(request: SearchRequest, db: Session = Depends(get_db)):
    """Semantic Search against Local Golden Records"""
    try:
        if not local_intelligence.embedding_model:
             local_intelligence.load_models()
        
        # We can reuse the service's embedding model
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

class ExecuteRequest(BaseModel):
    action: str # NAVIGATE, CLICK, TYPE
    payload: Dict

@app.post("/execute")
def execute_browser_action(request: ExecuteRequest):
    """Proxy for Browser Node (Puppeteer)"""
    # In a real CPS, this would forward to the Browser Service
    # For now, we simulate the 'Physical' side executing the action
    logger.info(f"PHYSICAL ACTUATOR: Executing {request.action} with {request.payload}")
    
    return {
        "status": "SUCCESS", 
        "message": f"Executed {request.action}",
        "hardware_ack": str(uuid.uuid4())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
