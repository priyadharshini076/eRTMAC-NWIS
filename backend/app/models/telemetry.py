from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database.base import Base

class DailyDrillingLog(Base):
    __tablename__ = "daily_drilling_logs"

    id = Column(Integer, primary_key=True)

    well_id = Column(
        String,
        ForeignKey("wells_master.well_id")
    )

    timestamp = Column(DateTime)

    depth_m = Column(Float)

    pressure_psi = Column(Float)

    torque_kNm = Column(Float)

    rpm = Column(Float)

    mud_weight_ppg = Column(Float)

    weight_on_bit_ton = Column(Float)

    flow_rate_lpm = Column(Float)

    event_label = Column(String)

    alert_level = Column(String)

    well = relationship("Well")