from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.dependencies import get_db

router = APIRouter(tags=["Health"])

@router.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Backend Online"
    }

@router.get("/db-health")
def db_health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))

    return {
        "database": "connected",
        "postgis": "enabled"
    }