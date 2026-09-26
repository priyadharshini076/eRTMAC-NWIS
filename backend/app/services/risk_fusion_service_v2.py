from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.intelligence_service import (
    WellNotFoundError,
    build_historical_intelligence,
)
from app.services.ml_inference_service_v2 import predict_incident_risk


def _risk_class(score: float) -> str:
    if score >= 70:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def _trigger_action(risk_class: str) -> str:
    if risk_class == "High":
        return "RAG_RETRIEVAL"
    if risk_class == "Medium":
        return "ENHANCED_MONITORING"
    return "CONTINUE_MONITORING"


def _historical_score(
    current_depth: float | None,
    intervals: list[dict[str, Any]],
    tolerance_m: float,
) -> tuple[float, list[dict[str, Any]], dict[str, Any] | None]:
    if current_depth is None:
        return 0.0, [], None

    matches = []

    severity_weight = {
        "Critical": 1.0,
        "High": 0.75,
        "Medium": 0.45,
        "Low": 0.20,
    }

    for interval in intervals:
        lo = interval.get("depth_min_m")
        hi = interval.get("depth_max_m")
        if lo is None or hi is None:
            continue

        lo = float(lo)
        hi = float(hi)

        if current_depth < lo:
            distance = lo - current_depth
        elif current_depth > hi:
            distance = current_depth - hi
        else:
            distance = 0.0

        if distance <= tolerance_m:
            matches.append((distance, interval))

    if not matches:
        return 0.0, [], None

    matches.sort(
        key=lambda item: (
            item[0],
            -int(item[1].get("supporting_well_count", 0)),
        )
    )

    distance, primary = matches[0]

    severity_factor = severity_weight.get(
        str(primary.get("highest_severity")),
        0.20,
    )
    support_factor = min(
        int(primary.get("supporting_well_count", 0)) / 3.0,
        1.0,
    )
    proximity_factor = max(
        0.0,
        1.0 - (distance / tolerance_m),
    )

    score = 40.0 * (
        0.40 * severity_factor
        + 0.30 * support_factor
        + 0.30 * proximity_factor
    )

    signals = []
    for match_distance, interval in matches[:5]:
        signals.append(
            {
                "signal_type": "historical_depth_match",
                "event_type": interval.get("event_type"),
                "current_depth_m": round(current_depth, 1),
                "historical_depth_min_m": interval.get("depth_min_m"),
                "historical_depth_max_m": interval.get("depth_max_m"),
                "distance_to_interval_m": round(match_distance, 1),
                "supporting_well_count": interval.get("supporting_well_count"),
                "highest_severity": interval.get("highest_severity"),
                "description": (
                    f"Current depth is {round(match_distance, 1)} m from a "
                    f"repeated {interval.get('event_type')} interval "
                    f"supported by {interval.get('supporting_well_count')} "
                    f"offset wells."
                ),
            }
        )

    return round(score, 2), signals, primary


def build_risk_fusion(
    db: Session,
    well_id: str,
    radius_m: float = 5000.0,
    depth_tolerance_m: float = 150.0,
    minimum_supporting_wells: int = 2,
    recent_window: int = 10,
) -> dict[str, Any]:
    latest_stmt = text(
        """
        SELECT
            d.id,
            d.well_id,
            w.field,
            w.district,
            w.formation,
            d.timestamp,
            d.depth_m,
            d.pressure_psi,
            d."torque_kNm",
            d.rpm,
            d.mud_weight_ppg,
            d.weight_on_bit_ton,
            d.flow_rate_lpm
        FROM daily_drilling_logs d
        JOIN wells_master w ON d.well_id = w.well_id
        WHERE d.well_id = :well_id
        ORDER BY d.timestamp DESC
        LIMIT :limit
        """
    )

    rows = db.execute(
        latest_stmt,
        {"well_id": well_id, "limit": recent_window},
    ).mappings().all()

    if not rows:
        raise WellNotFoundError(
            f"No telemetry found for well '{well_id}'."
        )

    telemetry = [dict(row) for row in reversed(rows)]
    latest = telemetry[-1]

    ml = predict_incident_risk(telemetry)

    historical = build_historical_intelligence(
        db=db,
        well_id=well_id,
        radius_m=radius_m,
        depth_tolerance_m=depth_tolerance_m,
        minimum_supporting_wells=minimum_supporting_wells,
    )

    historical_score, historical_signals, primary_interval = _historical_score(
        current_depth=float(latest["depth_m"]),
        intervals=historical["correlated_depth_intervals"],
        tolerance_m=depth_tolerance_m,
    )

    # Transparent V2 fusion:
    # ML early-warning probability -> 0..70 points
    # Historical offset/depth evidence -> 0..30 points
    ml_component = 70.0 * ml["incident_probability"]
    historical_component = 30.0 * (historical_score / 40.0)

    final_score = round(
        min(ml_component + historical_component, 100.0),
        2,
    )

    risk_class = _risk_class(final_score)
    trigger_action = _trigger_action(risk_class)

    signals = [
        {
            "signal_type": "ml_incident_probability",
            "incident_probability": ml["incident_probability"],
            "prediction_horizon_rows": ml.get("target_horizon_rows", 3),
            "threshold": ml.get("ml_alert_threshold"),
            "ml_alert": ml.get("ml_alert"),
            "points": round(ml_component, 2),
            "description": (
                "XGBoost estimates the probability that an incident will "
                "occur within the configured early-warning horizon."
            ),
        },
        *historical_signals,
    ]

    explanation = (
        f"ML early-warning contribution: {round(ml_component, 2)}/70. "
        f"Historical offset/depth contribution: {round(historical_component, 2)}/30. "
        f"The ML model predicts over the next "
        f"{ml.get('target_horizon_rows', 3)} telemetry rows."
    )

    return {
        "well": {
            "well_id": well_id,
            "formation": latest.get("formation"),
            "current_depth_m": latest.get("depth_m"),
        },
        "latest_telemetry": {
            key: latest.get(key)
            for key in [
                "timestamp",
                "depth_m",
                "pressure_psi",
                "torque_kNm",
                "rpm",
                "mud_weight_ppg",
                "weight_on_bit_ton",
                "flow_rate_lpm",
            ]
        },
        "ml_prediction": ml,
        "historical_context": {
            "nearby_well_count": historical["summary"]["nearby_well_count"],
            "same_formation_nearby_well_count": historical["summary"]["same_formation_nearby_well_count"],
            "same_formation_event_count": historical["summary"]["same_formation_event_count"],
            "correlated_interval_count": historical["summary"]["correlated_interval_count"],
        },
        "fusion": {
            "ml_component_points": round(ml_component, 2),
            "historical_component_points": round(historical_component, 2),
            "final_score": final_score,
            "risk_class": risk_class,
            "trigger_action": trigger_action,
        },
        "primary_historical_interval": primary_interval,
        "signals": signals,
        "explanation": explanation,
    }
