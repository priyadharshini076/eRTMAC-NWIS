from __future__ import annotations

from typing import Any


def build_trigger_result(
    risk_fusion: dict[str, Any],
) -> dict[str, Any]:

    fusion = risk_fusion.get("fusion", {})
    signals = risk_fusion.get("signals", [])

    final_score = float(
        fusion.get("final_score", 0)
    )

    risk_class = fusion.get(
        "risk_class",
        "Low",
    )

    ml_prediction = risk_fusion.get(
        "ml_prediction",
        {},
    )

    ml_alert = bool(
        ml_prediction.get(
            "ml_alert",
            False,
        )
    )

    primary_interval = risk_fusion.get(
        "primary_historical_interval"
    )

    trigger_signals = []

    # ---------------------------------------------------------
    # ML EARLY WARNING
    # ---------------------------------------------------------

    if ml_alert:
        trigger_signals.append(
            {
                "trigger_type": "ML_EARLY_WARNING",
                "severity": "Medium",
                "description": (
                    "The ML model detected an "
                    "early-warning incident signal "
                    "within the configured prediction horizon."
                ),
            }
        )

    # ---------------------------------------------------------
    # HISTORICAL DEPTH MATCH
    # ---------------------------------------------------------

    if primary_interval:

        support_count = int(
            primary_interval.get(
                "supporting_well_count",
                0,
            )
        )

        highest_severity = primary_interval.get(
            "highest_severity"
        )

        trigger_signals.append(
            {
                "trigger_type": "HISTORICAL_DEPTH_MATCH",
                "severity": highest_severity,
                "description": (
                    f'Current depth overlaps a historical '
                    f'{primary_interval.get("event_type")} '
                    f'interval supported by '
                    f'{support_count} offset wells.'
                ),
            }
        )

    # ---------------------------------------------------------
    # FINAL DECISION
    # ---------------------------------------------------------

    if final_score >= 70:

        trigger_state = "HIGH_RISK"
        action = "RAG_RETRIEVAL"
        priority = "HIGH"

    elif final_score >= 40:

        trigger_state = "MEDIUM_RISK"
        action = "ENHANCED_MONITORING"
        priority = "MEDIUM"

    else:

        trigger_state = "LOW_RISK"
        action = "CONTINUE_MONITORING"
        priority = "LOW"

    # ---------------------------------------------------------
    # ADDITIONAL CONTEXT
    # ---------------------------------------------------------

    if (
        ml_alert
        and primary_interval
    ):
        trigger_signals.append(
            {
                "trigger_type": "FUSED_SIGNAL",
                "severity": priority,
                "description": (
                    "Both the ML early-warning model "
                    "and historical depth intelligence "
                    "provide supporting evidence."
                ),
            }
        )

    return {
        "trigger_state": trigger_state,
        "priority": priority,
        "final_score": final_score,
        "action": action,
        "signals": trigger_signals,
        "rag_required": (
            action == "RAG_RETRIEVAL"
        ),
        "decision_summary": (
            f"Risk score {final_score:.2f}/100 "
            f"mapped to {trigger_state}. "
            f"Recommended system action: {action}."
        ),
    }