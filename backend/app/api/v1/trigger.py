from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User
from app.services.risk_fusion_service_v2 import (
    build_risk_fusion,
)
from app.services.trigger_service import (
    build_trigger_result,
)


router = APIRouter()


allow_roles = deps.RoleChecker(["drilling_engineer", "drilling_supervisor", "admin"])

@router.get("/wells/{well_id}/trigger")
def get_well_trigger(
    well_id: str,
    radius: float = Query(
        default=5000,
        ge=100,
        le=25000,
    ),
    depth_tolerance: float = Query(
        default=150,
        gt=0,
        le=1000,
    ),
    minimum_supporting_wells: int = Query(
        default=2,
        ge=1,
        le=10,
    ),
    recent_window: int = Query(
        default=10,
        ge=5,
        le=100,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_roles),
):

    try:

        risk_fusion = build_risk_fusion(
            db=db,
            well_id=well_id,
            radius_m=radius,
            depth_tolerance_m=depth_tolerance,
            minimum_supporting_wells=(
                minimum_supporting_wells
            ),
            recent_window=recent_window,
        )

        trigger = build_trigger_result(
            risk_fusion
        )

        return {
            "well_id": well_id,
            "risk_fusion": risk_fusion,
            "trigger": trigger,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Trigger generation failed: {exc}",
        ) from exc