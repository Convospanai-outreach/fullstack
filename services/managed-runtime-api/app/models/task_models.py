from pydantic import BaseModel, Field
from typing import Any, Optional, Dict

class TaskEnvelope(BaseModel):
    version: int = Field(default=1)
    task_type: str
    tenant_id: str
    execution_mode: str
    target_runtime: str
    task_id: str
    idempotency_key: str
    created_at: str
    expires_at: Optional[str] = None
    payload: Dict[str, Any]
    policy: Optional[Dict[str, Any]] = None
    audit_context: Optional[Dict[str, Any]] = None
    correlation_id: Optional[str] = None

class TokenizeRequest(BaseModel):
    text: str
    task: TaskEnvelope

class TokenizeResponse(BaseModel):
    sanitized_text: str
    token_map_id: str

class GenerateRequest(BaseModel):
    prompt: str
    task: TaskEnvelope

class GenerateResponse(BaseModel):
    text: str

class ClassifyRequest(BaseModel):
    text: str
    labels: list[str] | None = None
    task: TaskEnvelope

class ClassifyResponse(BaseModel):
    label: str
    score: float

class ExecuteRequest(BaseModel):
    action: str
    payload: Dict[str, Any]
    task: TaskEnvelope

class ExecuteResponse(BaseModel):
    status: str
    detail: Optional[str] = None

