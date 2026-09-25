from fastapi import FastAPI
from app.api.v1 import health

app = FastAPI(
    title="eRTMAC-NWIS API",
    version="1.0.0",
    description="AI-Powered Nearby Wells Intelligence System"
)

app.include_router(health.router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "project": "eRTMAC-NWIS",
        "status": "running"
    }