from fastapi import APIRouter
from .. import routes
from ...core.config import SERVICE_NAME, SERVICE_VERSION, DEFAULT_CAPABILITIES

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "healthy", "service": SERVICE_NAME, "version": SERVICE_VERSION}

@router.get("/ready")
def ready():
    return {"status": "ready"}

@router.get("/version")
def version():
    return {"version": SERVICE_VERSION}

@router.get("/capabilities")
def capabilities():
    return {"capabilities": DEFAULT_CAPABILITIES}

