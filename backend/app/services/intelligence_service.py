from __future__ import annotations

from collections import Counter, defaultdict
from math import asin, cos, radians, sin, sqrt
from statistics import mean
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session


SEVERITY_RANK = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


class WellNotFoundError(Exception):
    pass


def _normalize(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _same_text(a: Any, b: Any) -> bool:
    return _normalize(a).lower() == _normalize(b).lower()


def _haversine_distance_m(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """
    Calculate great-circle distance between two coordinates.
    Result is returned in metres.
    """

    earth_radius_m = 6_371_000.0

    lat1_r = radians(lat1)
    lat2_r = radians(lat2)

    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)

    a = (
        sin(delta_lat / 2) ** 2
        + cos(lat1_r)
        * cos(lat2_r)
        * sin(delta_lon / 2) ** 2
    )

    c = 2 * asin(sqrt(a))

    return earth_radius_m * c


def _severity_rank(severity: Any) -> int:
    return SEVERITY_RANK.get(
        _normalize(severity).title(),
        0,
    )


def _severity_breakdown(events: list[dict[str, Any]]) -> dict[str, int]:
    counts = Counter()

    for event in events:
        severity = _normalize(event.get("severity")).title()

        if severity:
            counts[severity] += 1

    return {
        "Critical": counts.get("Critical", 0),
        "High": counts.get("High", 0),
        "Medium": counts.get("Medium", 0),
        "Low": counts.get("Low", 0),
    }


def _event_summary(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for event in events:
        event_type = _normalize(event.get("event_type"))

        if event_type:
            grouped[event_type].append(event)

    summary = []

    for event_type, grouped_events in grouped.items():
        depths = [
            float(event["depth_m"])
            for event in grouped_events
            if event.get("depth_m") is not None
        ]

        unique_wells = sorted(
            {
                _normalize(event.get("well_id"))
                for event in grouped_events
                if _normalize(event.get("well_id"))
            }
        )

        summary.append(
            {
                "event_type": event_type,
                "event_count": len(grouped_events),
                "unique_well_count": len(unique_wells),
                "supporting_wells": unique_wells[:10],
                "severity": _severity_breakdown(grouped_events),
                "depth_min_m": min(depths) if depths else None,
                "depth_max_m": max(depths) if depths else None,
            }
        )

    summary.sort(
        key=lambda item: (
            -item["event_count"],
            -item["unique_well_count"],
            item["event_type"],
        )
    )

    return summary


def _cluster_depth_events(
    events: list[dict[str, Any]],
    depth_tolerance_m: float,
    minimum_supporting_wells: int,
) -> list[dict[str, Any]]:
    """
    Detect repeated event patterns at similar depths.

    Correlation rule:
        same formation
        + same event type
        + depths within depth_tolerance_m
        + at least minimum_supporting_wells distinct wells
    """

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for event in events:
        event_type = _normalize(event.get("event_type"))
        depth = event.get("depth_m")

        if not event_type or depth is None:
            continue

        grouped[event_type].append(event)

    correlations: list[dict[str, Any]] = []

    for event_type, event_list in grouped.items():
        event_list.sort(
            key=lambda event: float(event["depth_m"])
        )

        clusters: list[list[dict[str, Any]]] = []

        for event in event_list:
            depth = float(event["depth_m"])

            if not clusters:
                clusters.append([event])
                continue

            current_cluster = clusters[-1]

            current_depths = [
                float(item["depth_m"])
                for item in current_cluster
            ]

            cluster_mean = mean(current_depths)

            if abs(depth - cluster_mean) <= depth_tolerance_m:
                current_cluster.append(event)
            else:
                clusters.append([event])

        for cluster in clusters:
            supporting_wells = sorted(
                {
                    _normalize(event.get("well_id"))
                    for event in cluster
                    if _normalize(event.get("well_id"))
                }
            )

            if len(supporting_wells) < minimum_supporting_wells:
                continue

            depths = [
                float(event["depth_m"])
                for event in cluster
            ]

            severity_breakdown = _severity_breakdown(cluster)

            highest_severity = max(
                (
                    _normalize(event.get("severity")).title()
                    for event in cluster
                    if _normalize(event.get("severity"))
                ),
                key=lambda value: SEVERITY_RANK.get(value, 0),
                default=None,
            )

            correlations.append(
                {
                    "event_type": event_type,
                    "representative_depth_m": round(
                        mean(depths),
                        1,
                    ),
                    "depth_min_m": min(depths),
                    "depth_max_m": max(depths),
                    "depth_span_m": round(
                        max(depths) - min(depths),
                        1,
                    ),
                    "event_count": len(cluster),
                    "supporting_well_count": len(supporting_wells),
                    "supporting_wells": supporting_wells[:10],
                    "severity": severity_breakdown,
                    "highest_severity": highest_severity,
                }
            )

    correlations.sort(
        key=lambda item: (
            -item["supporting_well_count"],
            -_severity_rank(item["highest_severity"]),
            -item["event_count"],
        )
    )

    return correlations


def _build_nearby_well_summary(
    nearby_wells: list[dict[str, Any]],
    events: list[dict[str, Any]],
    target_formation: str,
) -> list[dict[str, Any]]:
    events_by_well: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for event in events:
        well_id = _normalize(event.get("well_id"))

        if well_id:
            events_by_well[well_id].append(event)

    result = []

    for well in nearby_wells:
        well_id = _normalize(well["well_id"])
        well_events = events_by_well.get(well_id, [])

        same_formation_events = [
            event
            for event in well_events
            if _same_text(
                event.get("formation"),
                target_formation,
            )
        ]

        # The events table stores well_id directly but not formation.
        # Therefore this list is supplied by the caller through a temporary
        # field attached to each event.
        if not same_formation_events:
            same_formation_events = [
                event
                for event in well_events
                if event.get("_well_same_formation") is True
            ]

        high_severity_events = [
            event
            for event in same_formation_events
            if _severity_rank(event.get("severity")) >= 3
        ]

        top_events = _event_summary(
            same_formation_events
        )[:5]

        result.append(
            {
                "well_id": well_id,
                "well_name": _normalize(well.get("well_name")),
                "formation": _normalize(well.get("formation")),
                "distance_m": round(
                    float(well["distance_m"]),
                    1,
                ),
                "same_formation": bool(
                    well.get("same_formation")
                ),
                "historical_event_count": len(
                    same_formation_events
                ),
                "high_severity_event_count": len(
                    high_severity_events
                ),
                "top_event_types": top_events,
            }
        )

    result.sort(
        key=lambda item: item["distance_m"]
    )

    return result


def build_historical_intelligence(
    db: Session,
    well_id: str,
    radius_m: float = 5000.0,
    depth_tolerance_m: float = 150.0,
    minimum_supporting_wells: int = 2,
) -> dict[str, Any]:
    """
    Build historical offset-well intelligence for one well.

    This V1 implementation uses:
        1. nearby spatial wells
        2. same-formation filtering
        3. historical event/severity aggregation
        4. repeated depth-pattern detection

    It intentionally does not calculate the final live risk score.
    """

    if radius_m < 100:
        raise ValueError("radius_m must be at least 100 metres.")

    if radius_m > 25_000:
        raise ValueError("radius_m cannot exceed 25,000 metres.")

    if depth_tolerance_m <= 0:
        raise ValueError(
            "depth_tolerance_m must be greater than zero."
        )

    if minimum_supporting_wells < 1:
        raise ValueError(
            "minimum_supporting_wells must be at least 1."
        )

    # ------------------------------------------------------------------
    # 1. Current well
    # ------------------------------------------------------------------

    current_well_stmt = text(
        """
        SELECT
            well_id,
            well_name,
            formation,
            latitude,
            longitude
        FROM wells_master
        WHERE well_id = :well_id
        LIMIT 1
        """
    )

    current_well = db.execute(
        current_well_stmt,
        {"well_id": well_id},
    ).mappings().first()

    if not current_well:
        raise WellNotFoundError(
            f"Well '{well_id}' was not found."
        )

    current_lat = float(current_well["latitude"])
    current_lon = float(current_well["longitude"])
    current_formation = _normalize(
        current_well["formation"]
    )

    # ------------------------------------------------------------------
    # 2. Load all wells
    #
    # Dataset is currently only 150 wells, so calculating exact distance
    # in Python is perfectly reasonable for this V1 intelligence layer.
    # Your existing nearby-wells endpoint remains the dedicated
    # PostGIS geospatial endpoint.
    # ------------------------------------------------------------------

    wells_stmt = text(
        """
        SELECT
            well_id,
            well_name,
            formation,
            latitude,
            longitude
        FROM wells_master
        """
    )

    all_wells = db.execute(
        wells_stmt
    ).mappings().all()

    nearby_wells = []

    for well in all_wells:
        candidate_id = _normalize(well["well_id"])

        if candidate_id == well_id:
            continue

        if well["latitude"] is None or well["longitude"] is None:
            continue

        candidate_lat = float(well["latitude"])
        candidate_lon = float(well["longitude"])

        distance_m = _haversine_distance_m(
            current_lat,
            current_lon,
            candidate_lat,
            candidate_lon,
        )

        if distance_m <= radius_m:
            nearby_wells.append(
                {
                    "well_id": candidate_id,
                    "well_name": _normalize(
                        well["well_name"]
                    ),
                    "formation": _normalize(
                        well["formation"]
                    ),
                    "latitude": candidate_lat,
                    "longitude": candidate_lon,
                    "distance_m": distance_m,
                    "same_formation": _same_text(
                        well["formation"],
                        current_formation,
                    ),
                }
            )

    nearby_wells.sort(
        key=lambda item: item["distance_m"]
    )

    nearby_well_ids = [
        well["well_id"]
        for well in nearby_wells
    ]

    # ------------------------------------------------------------------
    # 3. Load historical events for nearby wells
    # ------------------------------------------------------------------

    historical_events: list[dict[str, Any]] = []

    if nearby_well_ids:
        event_stmt = text(
            """
            SELECT
                id,
                well_id,
                event_date,
                depth_m,
                event_type,
                severity,
                description,
                mitigation,
                lesson,
                source_page,
                source_extraction_method
            FROM document_events
            WHERE well_id IN :well_ids
            ORDER BY well_id, depth_m NULLS LAST, event_date NULLS LAST
            """
        ).bindparams(
            bindparam(
                "well_ids",
                expanding=True,
            )
        )

        rows = db.execute(
            event_stmt,
            {"well_ids": nearby_well_ids},
        ).mappings().all()

        # Create formation lookup for each nearby well.
        formation_lookup = {
            well["well_id"]: well["formation"]
            for well in nearby_wells
        }

        for row in rows:
            event = dict(row)

            well_id_value = _normalize(
                event.get("well_id")
            )

            well_formation = formation_lookup.get(
                well_id_value,
                "",
            )

            event["_well_formation"] = well_formation
            event["_well_same_formation"] = _same_text(
                well_formation,
                current_formation,
            )

            historical_events.append(event)

    # ------------------------------------------------------------------
    # 4. Same-formation historical evidence
    # ------------------------------------------------------------------

    same_formation_events = [
        event
        for event in historical_events
        if event.get("_well_same_formation") is True
    ]

    high_severity_events = [
        event
        for event in same_formation_events
        if _severity_rank(event.get("severity")) >= 3
    ]

    critical_events = [
        event
        for event in same_formation_events
        if _severity_rank(event.get("severity")) >= 4
    ]

    same_formation_wells = [
        well
        for well in nearby_wells
        if well["same_formation"]
    ]

    # ------------------------------------------------------------------
    # 5. Event summary
    # ------------------------------------------------------------------

    event_summary = _event_summary(
        same_formation_events
    )

    # ------------------------------------------------------------------
    # 6. Repeated depth patterns
    # ------------------------------------------------------------------

    correlated_intervals = _cluster_depth_events(
        same_formation_events,
        depth_tolerance_m,
        minimum_supporting_wells,
    )

    # ------------------------------------------------------------------
    # 7. Nearby-well summaries
    # ------------------------------------------------------------------

    nearby_well_summary = _build_nearby_well_summary(
        nearby_wells,
        historical_events,
        current_formation,
    )

    # ------------------------------------------------------------------
    # 8. Historical evidence cards
    #
    # Keep a small, useful set for later RAG retrieval.
    # ------------------------------------------------------------------

    evidence_candidates = sorted(
        same_formation_events,
        key=lambda event: (
            -_severity_rank(event.get("severity")),
            float(event["depth_m"])
            if event.get("depth_m") is not None
            else float("inf"),
        ),
    )

    historical_evidence = []

    seen_evidence_keys = set()

    for event in evidence_candidates:
        key = (
            _normalize(event.get("event_type")),
            _normalize(event.get("severity")),
            event.get("depth_m"),
        )

        if key in seen_evidence_keys:
            continue

        seen_evidence_keys.add(key)

        event_date = event.get("event_date")

        historical_evidence.append(
            {
                "event_id": event.get("id"),
                "well_id": _normalize(
                    event.get("well_id")
                ),
                "event_date": (
                    event_date.isoformat()
                    if hasattr(
                        event_date,
                        "isoformat",
                    )
                    else event_date
                ),
                "depth_m": event.get("depth_m"),
                "event_type": _normalize(
                    event.get("event_type")
                ),
                "severity": _normalize(
                    event.get("severity")
                ),
                "description": _normalize(
                    event.get("description")
                ),
                "mitigation": _normalize(
                    event.get("mitigation")
                ),
                "lesson": _normalize(
                    event.get("lesson")
                ),
                "source_page": event.get(
                    "source_page"
                ),
                "source_extraction_method": _normalize(
                    event.get(
                        "source_extraction_method"
                    )
                ),
            }
        )

        if len(historical_evidence) >= 20:
            break

    # ------------------------------------------------------------------
    # 9. Historical signals
    # ------------------------------------------------------------------

    historical_signals = []

    if critical_events:
        historical_signals.append(
            {
                "signal_type": "critical_events_present",
                "event_count": len(critical_events),
                "description": (
                    "Critical-severity historical events "
                    "exist among same-formation offset wells."
                ),
            }
        )

    if high_severity_events:
        historical_signals.append(
            {
                "signal_type": "high_severity_events_present",
                "event_count": len(high_severity_events),
                "description": (
                    "High or Critical historical events "
                    "exist among same-formation offset wells."
                ),
            }
        )

    for interval in correlated_intervals[:10]:
        historical_signals.append(
            {
                "signal_type": "repeated_depth_pattern",
                "event_type": interval["event_type"],
                "representative_depth_m": interval[
                    "representative_depth_m"
                ],
                "depth_min_m": interval[
                    "depth_min_m"
                ],
                "depth_max_m": interval[
                    "depth_max_m"
                ],
                "supporting_well_count": interval[
                    "supporting_well_count"
                ],
                "description": (
                    f'{interval["event_type"]} was observed '
                    f'in a repeated depth interval across '
                    f'{interval["supporting_well_count"]} '
                    f'nearby wells.'
                ),
            }
        )

    return {
        "well": {
            "well_id": _normalize(
                current_well["well_id"]
            ),
            "well_name": _normalize(
                current_well["well_name"]
            ),
            "formation": current_formation,
            "latitude": current_lat,
            "longitude": current_lon,
        },
        "parameters": {
            "search_radius_m": radius_m,
            "depth_tolerance_m": depth_tolerance_m,
            "minimum_supporting_wells": (
                minimum_supporting_wells
            ),
        },
        "summary": {
            "nearby_well_count": len(
                nearby_wells
            ),
            "same_formation_nearby_well_count": len(
                same_formation_wells
            ),
            "historical_event_count": len(
                historical_events
            ),
            "same_formation_event_count": len(
                same_formation_events
            ),
            "high_severity_event_count": len(
                high_severity_events
            ),
            "critical_event_count": len(
                critical_events
            ),
            "correlated_interval_count": len(
                correlated_intervals
            ),
        },
        "event_summary": event_summary,
        "nearby_wells": nearby_well_summary,
        "correlated_depth_intervals": (
            correlated_intervals
        ),
        "historical_signals": historical_signals,
        "historical_evidence": historical_evidence,
    }