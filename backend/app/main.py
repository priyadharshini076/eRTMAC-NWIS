from fastapi import FastAPI
from app.api.v1 import health
from app.api.v1 import nearby
from app.api.v1 import intelligence
from app.api.v1 import risk
from app.api.v1 import trigger
from app.api.v1 import rag
from app.api.v1 import decision_support
app = FastAPI(
    title="eRTMAC-NWIS API",
    version="1.0.0",
    description="AI-Powered Nearby Wells Intelligence System"
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(nearby.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(trigger.router, prefix="/api/v1")
app.include_router(
    rag.router,
    prefix="/api/v1",
)
app.include_router(
    decision_support.router,
    prefix="/api/v1"
)