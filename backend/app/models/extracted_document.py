from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    Boolean,
    ForeignKey,
    UniqueConstraint,
)

from sqlalchemy.dialects.postgresql import JSONB

from app.database.base import Base


class ExtractedDocumentData(Base):

    __tablename__ = "extracted_document_data"

    id = Column(
        Integer,
        primary_key=True
    )

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False
    )

    well_id = Column(
        String,
        ForeignKey("wells_master.well_id"),
        nullable=True
    )

    page_number = Column(
        Integer,
        nullable=False
    )

    extraction_method = Column(
        String,
        nullable=False
    )

    extracted_text = Column(
        Text,
        nullable=True
    )

    extracted_json = Column(
        JSONB,
        nullable=True
    )

    confidence = Column(
        Float,
        nullable=True
    )

    reviewed = Column(
        Boolean,
        default=False,
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "page_number",
            name="uq_document_page"
        ),
    )