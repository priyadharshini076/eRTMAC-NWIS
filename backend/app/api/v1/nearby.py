from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.services.nearby_well_service import get_nearby_wells

router = APIRouter(tags=["Nearby Wells"])

@router.get("/nearby-wells")
def nearby_wells(
    well_id: str,
    radius: int = 5000,
    db: Session = Depends(get_db)
):
    return get_nearby_wells(
        db,
        well_id,
        radius
    )