from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


SEVERITY_RANK = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
}


def _normalize(value: Any) -> str:
    if value is None:
        return ""

    return " ".join(str(value).strip().lower().split())


def _severity_rank(value: Any) -> int:
    return SEVERITY_RANK.get(_normalize(value), 0)


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None

    if isinstance(value, date):
        return value

    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _unique_preserve(values: list[Any]) -> list[Any]:
    output = []
    seen = set()

    for value in values:
        if value in (None, ""):
            continue

        key = str(value)

        if key not in seen:
            seen.add(key)
            output.append(value)

    return output


def _can_merge_events(
    group: dict,
    row: dict,
    depth_tolerance_m: float,
    date_tolerance_days: int,
) -> bool:
    """
    Merge two raw document events only when they are very likely to
    describe the same underlying incident.

    Conditions:
    - same well
    - same event type
    - depth within tolerance
    - if both dates exist, dates must also be close
    """

    if group["well_id"] != row["well_id"]:
        return False

    if _normalize(group["event_type"]) != _normalize(row["event_type"]):
        return False

    group_depth = group.get("representative_depth_m")
    row_depth = row.get("depth_m")

    if group_depth is None or row_depth is None:
        return False

    if abs(float(group_depth) - float(row_depth)) > depth_tolerance_m:
        return False

    group_date = _parse_date(group.get("representative_event_date"))
    row_date = _parse_date(row.get("event_date"))

    if group_date and row_date:
        if abs((group_date - row_date).days) > date_tolerance_days:
            return False

    return True


def _deduplicate_events(
    rows: list[dict],
    depth_tolerance_m: float = 5.0,
    date_tolerance_days: int = 7,
) -> list[dict]:
    """
    Convert raw WCR/DDR rows into grouped operational incidents.

    Example:
        WCR Mud Loss @ 2254 m
        DDR Mud Loss @ 2254 m

    becomes:

        EV-001
        Lakwa-007
        Mud Loss
        2254 m
        Sources: WCR + DDR
    """

    groups: list[dict] = []

    for row in rows:
        row = dict(row)

        matched_group = None

        for group in groups:
            if _can_merge_events(
                group,
                row,
                depth_tolerance_m=depth_tolerance_m,
                date_tolerance_days=date_tolerance_days,
            ):
                matched_group = group
                break

        if matched_group is None:
            matched_group = {
                "well_id": row.get("well_id"),
                "well_name": row.get("well_name"),
                "formation": row.get("formation"),
                "event_type": row.get("event_type"),
                "representative_depth_m": row.get("depth_m"),
                "representative_event_date": row.get("event_date"),
                "highest_severity": row.get("severity"),
                "descriptions": [],
                "mitigations": [],
                "lessons": [],
                "source_event_ids": [],
                "source_documents": [],
                "source_pages": [],
                "source_extraction_methods": [],
                "source_records": [],
            }

            groups.append(matched_group)

        # Keep strongest severity across all source records.
        if _severity_rank(row.get("severity")) > _severity_rank(
            matched_group.get("highest_severity")
        ):
            matched_group["highest_severity"] = row.get("severity")

        # Prefer an actual date if the representative currently has none.
        if (
            matched_group.get("representative_event_date") is None
            and row.get("event_date") is not None
        ):
            matched_group["representative_event_date"] = row.get("event_date")

        if row.get("description"):
            matched_group["descriptions"].append(row["description"])

        if row.get("mitigation"):
            matched_group["mitigations"].append(row["mitigation"])

        if row.get("lesson"):
            matched_group["lessons"].append(row["lesson"])

        if row.get("event_id") is not None:
            matched_group["source_event_ids"].append(row["event_id"])

        if row.get("source_document"):
            matched_group["source_documents"].append(row["source_document"])

        if row.get("source_page") is not None:
            matched_group["source_pages"].append(row["source_page"])

        if row.get("source_extraction_method"):
            matched_group["source_extraction_methods"].append(
                row["source_extraction_method"]
            )

        matched_group["source_records"].append(
            {
                "event_id": row.get("event_id"),
                "source_document": row.get("source_document"),
                "source_page": row.get("source_page"),
                "source_extraction_method": row.get(
                    "source_extraction_method"
                ),
            }
        )

    # Deduplicate arrays and convert groups into final evidence records.
    evidence = []

    # Strongest events first, then closest to current depth.
    groups.sort(
        key=lambda item: (
            -_severity_rank(item.get("highest_severity")),
            abs(
                float(item.get("representative_depth_m") or 0)
                - 0.0
            ),
        )
    )

    for index, group in enumerate(groups, start=1):
        evidence_id = f"EV-{index:03d}"

        evidence.append(
            {
                "evidence_id": evidence_id,
                "well_id": group["well_id"],
                "well_name": group["well_name"],
                "formation": group["formation"],
                "event_type": group["event_type"],
                "severity": group["highest_severity"],
                "depth_m": group["representative_depth_m"],
                "event_date": group["representative_event_date"],
                "description": group["descriptions"][0]
                if group["descriptions"]
                else None,
                "mitigations": _unique_preserve(group["mitigations"]),
                "lessons": _unique_preserve(group["lessons"]),
                "source_event_ids": _unique_preserve(
                    group["source_event_ids"]
                ),
                "source_documents": _unique_preserve(
                    group["source_documents"]
                ),
                "source_pages": _unique_preserve(group["source_pages"]),
                "source_extraction_methods": _unique_preserve(
                    group["source_extraction_methods"]
                ),
                "source_count": len(group["source_records"]),
                "source_records": group["source_records"],
            }
        )

    return evidence


def retrieve_rag_evidence(
    db: Session,
    well_id: str,
    current_depth_m: float,
    depth_window_m: float = 200,
    max_results: int = 8,
    dedup_depth_tolerance_m: float = 5.0,
    dedup_date_tolerance_days: int = 7,
    primary_event_type: str | None = None,
    ml_event_types: list[str] | None = None,
) -> dict:
    """
    Retrieve historical evidence from other wells in the same formation
    and within the requested depth window.
    """

    primary_normalized = _normalize(primary_event_type) if primary_event_type else None

    ml_event_types = ml_event_types or []
    ml_normalized = {
        _normalize(event_type)
        for event_type in ml_event_types
        if event_type
    }

    current_well = db.execute(
        text(
            """
            SELECT
                well_id,
                well_name,
                formation
            FROM wells_master
            WHERE well_id = :well_id
            """
        ),
        {"well_id": well_id},
    ).mappings().first()

    if not current_well:
        return {
            "query": {
                "well_id": well_id,
                "formation": None,
                "current_depth_m": current_depth_m,
                "depth_window_m": depth_window_m,
            },
            "result_count": 0,
            "raw_result_count": 0,
            "evidence": [],
        }

    formation = current_well["formation"]

    rows = db.execute(
        text(
            """
            SELECT
                e.id AS event_id,
                e.well_id,
                w.well_name,
                w.formation,
                e.event_date,
                e.depth_m,

                ABS(e.depth_m - :current_depth)
                    AS distance_from_current_depth_m,

                e.event_type,
                e.severity,
                e.description,
                e.mitigation,
                e.lesson,
                e.source_page,
                e.source_extraction_method,
                d.file_name AS source_document

            FROM document_events e

            JOIN wells_master w
                ON w.well_id = e.well_id

            LEFT JOIN documents d
                ON d.id = e.document_id

            WHERE e.well_id <> :well_id

              AND LOWER(TRIM(w.formation))
                    = LOWER(TRIM(:formation))

              AND e.depth_m BETWEEN
                    (:current_depth - :depth_window)
                    AND
                    (:current_depth + :depth_window)

            ORDER BY
                CASE
                    WHEN LOWER(TRIM(e.event_type)) = LOWER(TRIM(:primary_event_type)) THEN 2
                    WHEN LOWER(TRIM(e.event_type)) = ANY(:ml_event_types) THEN 1
                    ELSE 0
                END DESC,

                CASE LOWER(e.severity)
                    WHEN 'critical' THEN 4
                    WHEN 'high' THEN 3
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 1
                    ELSE 0
                END DESC,

                ABS(e.depth_m - :current_depth) ASC

            LIMIT :raw_limit
            """
        ),
        {
            "well_id": well_id,
            "formation": formation,
            "current_depth": current_depth_m,
            "depth_window": depth_window_m,
            "primary_event_type": primary_event_type or "",
            "ml_event_types": [
                event.lower() for event in ml_event_types
            ],
            "raw_limit": max(
                max_results * 10,
                100,
            ),
        },
    ).mappings().all()

    raw_rows = [dict(row) for row in rows]

    evidence = _deduplicate_events(
        raw_rows,
        depth_tolerance_m=dedup_depth_tolerance_m,
        date_tolerance_days=dedup_date_tolerance_days,
    )

    def _relevance(item: dict) -> tuple[float, list[str]]:
        event_type = _normalize(
            item.get("event_type")
        )

        severity_rank = _severity_rank(
            item.get("severity")
        )

        distance = abs(
            float(item["depth_m"])
            - float(current_depth_m)
        )

        reasons = []
        score = 0.0

        # -------------------------------------------------
        # 1. Preferred event type
        # -------------------------------------------------

        if primary_normalized and event_type == primary_normalized:
            score += 70.0
            reasons.append(
                "matches_primary_historical_signal"
            )
        elif event_type in ml_normalized:
            score += 45.0
            reasons.append(
                "matches_ml_event_candidate"
            )

        # -------------------------------------------------
        # 2. Depth proximity
        # -------------------------------------------------

        proximity = max(
            0.0,
            1.0
            - (
                distance
                / float(depth_window_m)
            ),
        )

        proximity_points = 30.0 * proximity

        score += proximity_points

        if distance == 0:
            reasons.append(
                "exact_depth_match"
            )
        elif distance <= 50:
            reasons.append(
                "very_close_depth_match"
            )
        elif distance <= 100:
            reasons.append(
                "close_depth_match"
            )

        # -------------------------------------------------
        # 3. Historical severity
        # -------------------------------------------------

        severity_points = {
            4: 24.0,
            3: 18.0,
            2: 12.0,
            1: 6.0,
            0: 0.0,
        }.get(
            severity_rank,
            0.0,
        )

        score += severity_points

        if severity_rank >= 4:
            reasons.append(
                "critical_historical_event"
            )
        elif severity_rank >= 3:
            reasons.append(
                "high_severity_historical_event"
            )

        return score, reasons

    ranked_evidence = []

    for item in evidence:
        score, reasons = _relevance(item)

        item["retrieval_relevance_points"] = round(
            score,
            2,
        )

        item["relevance_reasons"] = reasons

        ranked_evidence.append(item)

    ranked_evidence.sort(
        key=lambda item: (
            -item["retrieval_relevance_points"],
            -_severity_rank(
                item["severity"]
            ),
            abs(
                float(item["depth_m"])
                - float(current_depth_m)
            ),
        )
    )

    evidence = ranked_evidence[:max_results]

    # Reassign evidence IDs after final ranking.
    for index, item in enumerate(evidence, start=1):
        item["evidence_id"] = f"EV-{index:03d}"
        item["retrieval_rank"] = index

    return {
        "query": {
            "well_id": well_id,
            "formation": formation,
            "current_depth_m": current_depth_m,
            "depth_window_m": depth_window_m,
        },
        "raw_result_count": len(raw_rows),
        "result_count": len(evidence),
        "deduplication": {
            "enabled": True,
            "depth_tolerance_m": dedup_depth_tolerance_m,
            "date_tolerance_days": dedup_date_tolerance_days,
        },
        "retrieval_strategy": {
            "primary_event_type": primary_event_type,
            "ml_event_types": ml_event_types,
            "ranking": [
                "risk_signal_match",
                "depth_proximity",
                "severity",
            ],
        },
        "evidence": evidence,
    }