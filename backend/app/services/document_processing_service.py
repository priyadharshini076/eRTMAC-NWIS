from datetime import date
from pathlib import Path
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_event import DocumentEvent
from app.models.extracted_document import (
    ExtractedDocumentData,
)

from app.services.ocr_service import (
    extract_pdf,
)

from app.services.extraction_service import (
    extract_entities,
)

from app.services.validation_service import (
    validate_extracted_data,
)


def _parse_event_date(
    value: str | None,
):
    if not value:
        return None

    try:
        return date.fromisoformat(
            value
        )
    except ValueError:
        return None


def _locate_event_page(
    event: dict,
    pages: list[dict],
) -> int | None:

    event_type = (
        event.get("event_type") or event.get("event") or ""
    ).lower()

    depth = event.get(
        "depth_m"
    )

    depth_text = (
        str(int(depth))
        if depth is not None
        and float(depth).is_integer()
        else str(depth)
        if depth is not None
        else ""
    )

    event_date = event.get(
        "event_date"
    ) or event.get(
        "date"
    )

    # First try exact event + depth
    for page in pages:

        if page.get(
            "is_duplicate",
            False,
        ):
            continue

        text = page.get(
            "text",
            "",
        ).lower()

        if (
            event_type
            and event_type in text
            and depth_text
            and depth_text in text
        ):

            if (
                not event_date
                or event_date in text
            ):
                return page[
                    "page_number"
                ]

    # Fallback: event type only
    for page in pages:

        if page.get(
            "is_duplicate",
            False,
        ):
            continue

        text = page.get(
            "text",
            "",
        ).lower()

        if (
            event_type
            and event_type in text
        ):

            return page[
                "page_number"
            ]

    return None


def _extract_event_description(
    event: dict,
) -> tuple[str | None, str | None, str | None]:

    details = event.get(
        "details"
    )

    if not details:
        return (
            None,
            None,
            None,
        )

    details = re.sub(
        r"\s+",
        " ",
        details,
    ).strip()

    description = details
    mitigation = None
    lesson = None

    # -----------------------------------------------------
    # Split DDR/WCR text where these labels exist.
    # -----------------------------------------------------

    mitigation_match = re.search(
        r"Mitigation:\s*(.*?)(?="
        r"\s+Lesson:|\s+Outcome:|$)",
        details,
        re.IGNORECASE,
    )

    lesson_match = re.search(
        r"Lesson:\s*(.*)$",
        details,
        re.IGNORECASE,
    )

    if mitigation_match:

        mitigation = (
            mitigation_match
            .group(1)
            .strip()
        )

    if lesson_match:

        lesson = (
            lesson_match
            .group(1)
            .strip()
        )

    if mitigation_match:

        description = re.split(
            r"\s+Mitigation:",
            details,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip()

    return (
        description or None,
        mitigation,
        lesson,
    )


def process_document(
    db: Session,
    file_path: str,
) -> dict:

    path = Path(
        file_path
    )

    if not path.exists():
        raise FileNotFoundError(
            f"Document not found: {path}"
        )

    # =====================================================
    # Find document metadata
    # =====================================================

    document = db.scalar(
        select(Document).where(
            Document.file_name
            == path.name
        )
    )

    if document is None:
        raise ValueError(
            f"No document metadata found "
            f"for: {path.name}"
        )

    # =====================================================
    # Extract PDF / OCR
    # =====================================================

    extraction = extract_pdf(
        str(path)
    )

    document_type = (
        document.document_type
        or "UNKNOWN"
    ).upper()

    # =====================================================
    # Extract entities
    # =====================================================

    entities = extract_entities(
        text=extraction[
            "full_text"
        ],
        document_type=document_type,
        expected_well_id=document.well_id,
    )

    # =====================================================
    # Validation
    # =====================================================

    validation = validate_extracted_data(
        data=entities,
        document_type=document_type,
        source_text=extraction[
            "full_text"
        ],
    )

    # =====================================================
    # Remove previous extracted records
    # =====================================================

    db.query(
        ExtractedDocumentData
    ).filter(
        ExtractedDocumentData.document_id
        == document.id
    ).delete(
        synchronize_session=False
    )

    # =====================================================
    # Remove previous normalized events
    # =====================================================

    db.query(
        DocumentEvent
    ).filter(
        DocumentEvent.document_id
        == document.id
    ).delete(
        synchronize_session=False
    )

    # =====================================================
    # Persist page-level extraction
    # =====================================================

    for page in extraction[
        "pages"
    ]:

        extracted_json = {
            "document_type": document_type,
            "parser": (
                "wcr_extractor"
                if document_type == "WCR"
                else "ddr_extractor"
                if document_type == "DDR"
                else "unknown"
            ),
            "entities": entities,
            "validation": validation,
            "is_duplicate": page.get(
                "is_duplicate",
                False,
            ),
        }

        record = ExtractedDocumentData(
            document_id=document.id,
            well_id=entities.get(
                "well_id"
            ),
            page_number=page[
                "page_number"
            ],
            extraction_method=page[
                "extraction_method"
            ],
            extracted_text=page[
                "text"
            ],
            extracted_json=extracted_json,
            confidence=page.get(
                "confidence"
            ),
            reviewed=False,
        )

        db.add(record)

    # =====================================================
    # Persist normalized document events
    # =====================================================

    event_records = []

    for event in entities.get(
        "events",
        [],
    ):

        source_page = (
            _locate_event_page(
                event,
                extraction[
                    "pages"
                ],
            )
        )

        description, mitigation, lesson = (
            _extract_event_description(
                event
            )
        )

        event_record = DocumentEvent(
            document_id=document.id,
            well_id=entities.get(
                "well_id"
            ),
            event_date=_parse_event_date(
                event.get("event_date") or event.get("date")
            ),
            depth_m=event.get(
                "depth_m"
            ),
            event_type=event.get(
                "event_type"
            ) or event.get(
                "event"
            ),
            severity=event.get(
                "severity"
            ),
            description=description,
            mitigation=mitigation,
            lesson=lesson,
            source_page=source_page,
            source_extraction_method=(
                extraction[
                    "pages"
                ][
                    source_page - 1
                ][
                    "extraction_method"
                ]
                if source_page
                and source_page <= len(
                    extraction[
                        "pages"
                    ]
                )
                else None
            ),
        )

        db.add(
            event_record
        )

        event_records.append(
            event_record
        )

    # =====================================================
    # Commit everything together
    # =====================================================

    db.commit()

    return {
        "document_id": document.id,
        "document_type": document_type,
        "file_name": path.name,
        "page_count": extraction[
            "page_count"
        ],
        "extraction_methods": [
            page[
                "extraction_method"
            ]
            for page in extraction[
                "pages"
            ]
        ],
        "duplicate_pages": extraction.get(
            "duplicate_pages",
            [],
        ),
        "well_id": entities.get(
            "well_id"
        ),
        "well_id_source": entities.get(
            "well_id_source"
        ),
        "well_name": entities.get(
            "well_name"
        ),
        "formation": entities.get(
            "formation"
        ),
        "event_count": len(
            event_records
        ),
        "validation": validation,
        "reported_event_count": entities.get(
            "reported_event_count"
        ),
    }