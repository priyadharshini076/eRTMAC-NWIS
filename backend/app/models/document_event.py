from sqlalchemy import (
    Column,
    Date,
    Float,
    Integer,
    String,
    Text,
    ForeignKey,
    Index,
)

from app.database.base import Base


class DocumentEvent(Base):
    __tablename__ = "document_events"

    id = Column(Integer, primary_key=True)

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False,
    )

    well_id = Column(
        String,
        ForeignKey("wells_master.well_id"),
        nullable=False,
    )

    event_date = Column(
        Date,
        nullable=True,
    )

    depth_m = Column(
        Float,
        nullable=True,
    )

    event_type = Column(
        String,
        nullable=False,
    )

    severity = Column(
        String,
        nullable=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    mitigation = Column(
        Text,
        nullable=True,
    )

    lesson = Column(
        Text,
        nullable=True,
    )

    source_page = Column(
        Integer,
        nullable=True,
    )

    source_extraction_method = Column(
        String,
        nullable=True,
    )

    __table_args__ = (
        Index(
            "idx_document_events_well",
            "well_id",
        ),
        Index(
            "idx_document_events_type",
            "event_type",
        ),
        Index(
            "idx_document_events_depth",
            "depth_m",
        ),
        Index(
            "idx_document_events_document",
            "document_id",
        ),
    )