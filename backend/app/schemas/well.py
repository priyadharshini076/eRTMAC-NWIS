from pydantic import BaseModel, ConfigDict


class WellResponse(BaseModel):
    well_id: str
    well_name: str
    field: str
    formation: str
    latitude: float
    longitude: float

    model_config = ConfigDict(from_attributes=True)

class NearbyWellResponse(BaseModel):

    well_id:str
    well_name:str
    formation:str

    latitude:float
    longitude:float

    distance_m:float

    historical_events:int
    high_severity_events:int

    latest_event:str

    model_config=ConfigDict(from_attributes=True)