from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User

from app.services.intelligence_service import (
    WellNotFoundError,
)

from app.services.risk_fusion_service_v2 import (
    build_risk_fusion,
)


router = APIRouter()

allow_engineers = deps.RoleChecker(["drilling_engineer", "admin", "drilling_supervisor"])

@router.get("/wells/{well_id}/risk")
def get_well_risk(
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
    current_user: User = Depends(allow_engineers),
):
    try:
        return build_risk_fusion(
            db=db,
            well_id=well_id,
            radius_m=radius,
            depth_tolerance_m=depth_tolerance,
            minimum_supporting_wells=minimum_supporting_wells,
            recent_window=recent_window,
        )

    except WellNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Risk fusion failed: {exc}",
        ) from exc