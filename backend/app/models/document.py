from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.base import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)

    well_id = Column(
        String,
        ForeignKey("wells_master.well_id")
    )

    document_type = Column(String)

    file_name = Column(String)

    file_path = Column(String)

    status = Column(String)

    well = relationship("Well")