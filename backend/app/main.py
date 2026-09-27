from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from app.api.v1 import health
from app.api.v1 import nearby
from app.api.v1 import intelligence
from app.api.v1 import risk
from app.api.v1 import trigger
from app.api.v1 import rag
from app.api.v1 import decision_support
from app.api.v1 import auth

app = FastAPI(
    title="eRTMAC-NWIS API",
    version="1.0.0",
    description="AI-Powered Nearby Wells Intelligence System"
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 2. CORS setup
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# 2b. Basic Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
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