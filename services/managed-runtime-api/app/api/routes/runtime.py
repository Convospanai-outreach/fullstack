from fastapi import APIRouter, Depends
from fastapi import Request
from ...core.security import verify_signature
from ...models.task_models import (
    TokenizeRequest, TokenizeResponse,
    GenerateRequest, GenerateResponse,
    ClassifyRequest, ClassifyResponse,
    ExecuteRequest, ExecuteResponse
)
from ...services.tokenization_service import tokenize
from ...services.model_router import generate_text, classify_text
from ...services.task_executor import execute_action
from ...services.policy_guard import enforce_policy
from ...services.audit_service import record_audit

router = APIRouter(prefix="/v1")

async def signed_request(request: Request):
    body = await request.body()
    verify_signature(body=body)
    return True

@router.post("/tokenize", response_model=TokenizeResponse, dependencies=[Depends(signed_request)])
def tokenize_text(req: TokenizeRequest):
    enforce_policy(req.task.policy)
    sanitized, token_map_id = tokenize(req.text)
    record_audit(req.task.task_id, "tokenize", {"token_map_id": token_map_id})
    return TokenizeResponse(sanitized_text=sanitized, token_map_id=token_map_id)

@router.post("/generate", response_model=GenerateResponse, dependencies=[Depends(signed_request)])
def generate(req: GenerateRequest):
    enforce_policy(req.task.policy)
    text = generate_text(req.prompt)
    record_audit(req.task.task_id, "generate", None)
    return GenerateResponse(text=text)

@router.post("/classify", response_model=ClassifyResponse, dependencies=[Depends(signed_request)])
def classify(req: ClassifyRequest):
    enforce_policy(req.task.policy)
    label, score = classify_text(req.text, req.labels)
    record_audit(req.task.task_id, "classify", {"label": label, "score": score})
    return ClassifyResponse(label=label, score=score)

@router.post("/execute", response_model=ExecuteResponse, dependencies=[Depends(signed_request)])
def execute(req: ExecuteRequest):
    enforce_policy(req.task.policy)
    status, detail = execute_action(req.action, req.payload)
    record_audit(req.task.task_id, "execute", {"status": status})
    return ExecuteResponse(status=status, detail=detail)

