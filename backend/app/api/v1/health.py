from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User

router = APIRouter(tags=["Health"])

allow_admin = deps.RoleChecker(["admin"])

@router.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Backend Online"
    }

@router.get("/db-health")
def db_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_admin),
):
    db.execute(text("SELECT 1"))

    return {
        "database": "connected",
        "postgis": "enabled"
    }