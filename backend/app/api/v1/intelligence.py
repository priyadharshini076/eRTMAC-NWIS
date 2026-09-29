from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.services.intelligence_service import (
    WellNotFoundError,
    build_historical_intelligence,
)

# IMPORTANT:
# Keep the same get_db import that your working nearby-wells
# endpoint currently uses.
from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User


router = APIRouter()


allow_roles = deps.RoleChecker(["drilling_engineer", "drilling_supervisor", "geologist", "well_planner", "admin"])

@router.get("/wells/{well_id}/intelligence")
def get_well_intelligence(
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
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_roles),
):
    """
    Historical Offset-Well Intelligence Builder.

    Combines:
    - nearby wells
    - formation similarity
    - historical event frequency
    - severity
    - repeated depth patterns
    - mitigation / lesson evidence
    """

    try:
        return build_historical_intelligence(
            db=db,
            well_id=well_id,
            radius_m=radius,
            depth_tolerance_m=depth_tolerance,
            minimum_supporting_wells=(
                minimum_supporting_wells
            ),
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
            detail=f"Intelligence generation failed: {exc}",
        ) from exc