from pydantic import BaseModel, ConfigDict


class CurrentWell(BaseModel):
    well_id: str
    well_name: str
    formation: str

    model_config = ConfigDict(from_attributes=True)


class Summary(BaseModel):
    nearby_wells: int
    nearest_distance_m: float
    dominant_formation: str
    total_historical_events: int
    total_high_severity_events: int


class TopRiskWell(BaseModel):
    well_id: str
    well_name: str
    risk_score: int


class EventFrequency(BaseModel):
    event: str
    count: int


class WellIntelligenceResponse(BaseModel):
    current_well: CurrentWell
    summary: Summary
    top_risk_wells: list[TopRiskWell]
    top_event_types: list[EventFrequency]