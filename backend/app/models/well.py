from sqlalchemy import Column, Integer, String, Float, Date
from geoalchemy2 import Geometry

from app.database.base import Base

class Well(Base):
    __tablename__ = "wells_master"

    id = Column(Integer, primary_key=True)

    well_id = Column(String, unique=True, nullable=False)
    well_name = Column(String)
    api_number = Column(String)

    field = Column(String)
    district = Column(String)
    formation = Column(String)

    latitude = Column(Float)
    longitude = Column(Float)

    geom = Column(String, nullable=True)

    target_depth_m = Column(Float)
    measured_depth_m = Column(Float)
    true_vertical_depth_m = Column(Float)

    rig_name = Column(String)

    spud_date = Column(Date)
    completion_date = Column(Date)

    risk_zone = Column(String)
    surface_casing = Column(String)