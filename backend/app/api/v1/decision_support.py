from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User
from app.services.decision_support_service import (
    build_decision_support,
)


router = APIRouter(
    tags=["Decision Support"]
)


allow_roles = deps.RoleChecker(["drilling_engineer", "drilling_supervisor", "admin"])

@router.get(
    "/wells/{well_id}/decision-support"
)
def get_decision_support(
    well_id: str,

    radius: float = Query(
        5000,
        gt=0,
        le=20000,
    ),

    depth_tolerance: float = Query(
        150,
        gt=0,
        le=1000,
    ),

    minimum_supporting_wells: int = Query(
        2,
        ge=1,
        le=20,
    ),

    recent_window: int = Query(
        10,
        ge=3,
        le=50,
    ),

    rag_depth_window: float = Query(
        200,
        gt=0,
        le=1000,
    ),

    rag_max_results: int = Query(
        8,
        ge=1,
        le=20,
    ),

    force_rag: bool = Query(
        False
    ),

    db: Session = Depends(get_db),
    current_user: User = Depends(allow_roles),
):
    return build_decision_support(
        db=db,
        well_id=well_id,
        radius_m=radius,
        depth_tolerance_m=depth_tolerance,
        minimum_supporting_wells=minimum_supporting_wells,
        recent_window=recent_window,
        rag_depth_window_m=rag_depth_window,
        rag_max_results=rag_max_results,
        force_rag=force_rag,
    )