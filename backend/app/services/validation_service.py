import re
from typing import Any


ALLOWED_FORMATIONS = {
    "girujan",
    "tipam",
    "barail",
    "kopili",
    "lakadong+therria",
}


def _flat(text: str) -> str:
    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def extract_reported_event_count(
    text: str,
) -> int | None:
    """
    Extract event count stated by the document itself.

    Example:
    'knowledge record links 8 historical operational events'
    """

    flat_text = _flat(text)

    patterns = [
        r"links\s+(\d+)\s+historical\s+operational\s+events",
        r"links\s+(\d+)\s+operational\s+events",
        r"(\d+)\s+historical\s+operational\s+events",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            flat_text,
            re.IGNORECASE,
        )

        if match:
            return int(
                match.group(1)
            )

    return None


def detect_event_section(
    source_text: str,
    document_type: str,
) -> bool:
    """
    Detect whether the document contains its expected
    event/lesson section.

    WCR documents may use either:

        Significant Historical Events and Lessons

    or OCR/scanned variants such as:

        Significant Events:

    DDR documents use:

        Operational Events / Lessons
    """

    upper = (source_text or "").upper()

    document_type = (
        document_type or ""
    ).upper()

    if document_type == "WCR":

        return (
            "SIGNIFICANT HISTORICAL EVENTS" in upper
            or "SIGNIFICANT EVENTS" in upper
        )

    if document_type == "DDR":

        return (
            "OPERATIONAL EVENTS / LESSONS" in upper
            or "OPERATIONAL EVENTS" in upper
        )

    return False


def validate_extracted_data(
    data: dict[str, Any],
    document_type: str = "WCR",
    source_text: str = "",
) -> dict[str, Any]:

    warnings: list[str] = []

    document_type = document_type.upper()

    # =====================================================
    # Required well ID
    # =====================================================

    if not data.get("well_id"):
        warnings.append(
            "Missing well_id"
        )

    # =====================================================
    # Required formation
    # =====================================================

    formation = data.get(
        "formation"
    )

    if not formation:

        warnings.append(
            "Missing formation"
        )

    else:

        formation_normalized = (
            formation.strip()
            .lower()
        )

        if formation_normalized not in (
            ALLOWED_FORMATIONS
        ):
            warnings.append(
                f"Unknown formation: {formation}"
            )

    # =====================================================
    # WCR validation
    # =====================================================

    if document_type == "WCR":

        measured_depth = data.get(
            "measured_depth_m"
        )

        if measured_depth is None:

            warnings.append(
                "Missing measured_depth_m"
            )

        elif measured_depth <= 0:

            warnings.append(
                "Invalid measured_depth_m"
            )

        elif measured_depth >= 10000:

            warnings.append(
                "Unusually large measured_depth_m"
            )

    # =====================================================
    # DDR validation
    # =====================================================

    if document_type == "DDR":

        current_depth = data.get(
            "current_depth_m"
        )

        if current_depth is None:

            warnings.append(
                "Missing current_depth_m"
            )

        elif current_depth <= 0:

            warnings.append(
                "Invalid current_depth_m"
            )

        elif current_depth >= 10000:

            warnings.append(
                "Unusually large current_depth_m"
            )

    # =====================================================
    # Event consistency
    # =====================================================

    extracted_events = data.get(
        "events",
        [],
    )

    extracted_event_count = len(
        extracted_events
    )

    event_section_present = (
        detect_event_section(
            source_text,
            document_type,
        )
    )

    reported_event_count = (
        extract_reported_event_count(
            source_text
        )
    )

    # Store these values in the result
    # so they are available to downstream services.

    data["event_section_present"] = (
        event_section_present
    )

    data["reported_event_count"] = (
        reported_event_count
    )

    data["extracted_event_count"] = (
        extracted_event_count
    )

    # -----------------------------------------------------
    # Document says there are N events,
    # parser found a different number.
    # -----------------------------------------------------

    if (
        reported_event_count is not None
        and reported_event_count
        != extracted_event_count
    ):

        warnings.append(
            "Document-reported event count "
            f"({reported_event_count}) differs "
            "from extracted event count "
            f"({extracted_event_count})"
        )

    # -----------------------------------------------------
    # Section exists but parser found zero.
    # -----------------------------------------------------

    if (
        event_section_present
        and extracted_event_count == 0
    ):

        warnings.append(
            "Event section detected but "
            "no events were extracted"
        )

    return {
        "valid": len(warnings) == 0,
        "warnings": warnings,
        "event_section_present": (
            event_section_present
        ),
        "reported_event_count": (
            reported_event_count
        ),
        "extracted_event_count": (
            extracted_event_count
        ),
    }