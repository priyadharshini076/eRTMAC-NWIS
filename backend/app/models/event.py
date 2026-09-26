from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.database.base import Base

class DrillingEvent(Base):
    __tablename__ = "drilling_events"

    id = Column(Integer, primary_key=True)

    well_id = Column(
        String,
        ForeignKey("wells_master.well_id")
    )

    event_date = Column(Date)

    depth_m = Column(Float)

    event_type = Column(String)

    severity = Column(String)

    formation = Column(String)

    mitigation_action = Column(String)

    well = relationship("Well")