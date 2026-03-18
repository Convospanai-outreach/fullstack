from fastapi import FastAPI
from .api.routes.health import router as health_router
from .api.routes.runtime import router as runtime_router

app = FastAPI(title="ConvoSpan Managed Runtime")

app.include_router(health_router)
app.include_router(runtime_router)

