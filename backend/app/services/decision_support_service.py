from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.llm_service import generate_rag_response
from app.services.rag_service import retrieve_rag_evidence
from app.services.risk_fusion_service_v2 import build_risk_fusion


def _build_trigger_decision(
    risk_result: dict[str, Any],
) -> dict[str, Any]:
    fusion = risk_result["fusion"]
    final_score = float(fusion["final_score"])

    ml = risk_result.get("ml_prediction", {})
    risk_class = fusion["risk_class"]

    if final_score >= 70:
        trigger_state = "HIGH_RISK"
        priority = "HIGH"
        action = "RAG_RETRIEVAL"
        rag_required = True

    elif final_score >= 40:
        trigger_state = "MEDIUM_RISK"
        priority = "MEDIUM"
        action = "ENHANCED_MONITORING"
        rag_required = False

    else:
        trigger_state = "LOW_RISK"
        priority = "LOW"
        action = "CONTINUE_MONITORING"
        rag_required = False

    signals = []

    if ml.get("ml_alert"):
        signals.append("ML_EARLY_WARNING")

    historical_signals = risk_result.get("signals", [])

    if any(
        signal.get("signal_type") == "historical_depth_match"
        for signal in historical_signals
    ):
        signals.append("HISTORICAL_DEPTH_MATCH")

    if final_score >= 40:
        signals.append("FUSED_SIGNAL")

    decision_summary = (
        f"Risk score {final_score:.2f}/100 mapped to "
        f"{trigger_state}. Recommended system action: {action}."
    )

    return {
        "trigger_state": trigger_state,
        "priority": priority,
        "risk_class": risk_class,
        "final_score": final_score,
        "action": action,
        "signals": signals,
        "rag_required": rag_required,
        "decision_summary": decision_summary,
    }


def build_decision_support(
    db: Session,
    well_id: str,
    radius_m: float = 5000.0,
    depth_tolerance_m: float = 150.0,
    minimum_supporting_wells: int = 2,
    recent_window: int = 10,
    rag_depth_window_m: float = 200.0,
    rag_max_results: int = 8,
    force_rag: bool = False,
) -> dict[str, Any]:

    # ---------------------------------------------------------
    # STEP 1 — ML + Historical Risk Fusion
    # ---------------------------------------------------------

    risk_result = build_risk_fusion(
        db=db,
        well_id=well_id,
        radius_m=radius_m,
        depth_tolerance_m=depth_tolerance_m,
        minimum_supporting_wells=minimum_supporting_wells,
        recent_window=recent_window,
    )

    # ---------------------------------------------------------
    # STEP 2 — Trigger Engine
    # ---------------------------------------------------------

    trigger_result = _build_trigger_decision(
        risk_result
    )

    # ---------------------------------------------------------
    # STEP 3 — Decide whether RAG should execute
    # ---------------------------------------------------------

    rag_should_run = (
        trigger_result["rag_required"]
        or force_rag
    )

    if not rag_should_run:
        return {
            "well_id": well_id,
            "pipeline_status": "RAG_NOT_REQUIRED",
            "risk": risk_result,
            "trigger": trigger_result,
            "rag": {
                "executed": False,
                "reason": "Trigger policy did not require RAG.",
            },
        }

    # ---------------------------------------------------------
    # STEP 4 — RAG Retrieval
    # ---------------------------------------------------------

    well_context = risk_result["well"]

    current_depth = float(
        well_context["current_depth_m"]
    )

    primary_event_type = None

    # Primary historical interval
    primary_interval = risk_result.get(
        "primary_historical_interval"
    )

    if primary_interval:
        primary_event_type = primary_interval.get(
            "event_type"
        )

    # ML event-type candidates
    ml_candidates = risk_result.get(
        "ml_prediction",
        {},
    ).get(
        "event_type_candidates",
        []
    )

    ml_event_types = []
    for candidate in ml_candidates:
        event_type = candidate.get("event_type")
        if event_type:
            ml_event_types.append(event_type)

    ml_event_types = list(dict.fromkeys(ml_event_types))

    # All preferred event types (for LLM context)
    preferred_event_types = []
    if primary_event_type:
        preferred_event_types.append(primary_event_type)
    preferred_event_types.extend(ml_event_types)
    preferred_event_types = list(dict.fromkeys(preferred_event_types))

    retrieval = retrieve_rag_evidence(
        db=db,
        well_id=well_id,
        current_depth_m=current_depth,
        depth_window_m=rag_depth_window_m,
        max_results=rag_max_results,
        primary_event_type=primary_event_type,
        ml_event_types=ml_event_types,
    )

    # ---------------------------------------------------------
    # STEP 5 — Gemini Grounded Generation
    # ---------------------------------------------------------

    query = {
        **retrieval["query"],
        "focus_event_types": preferred_event_types,
        "primary_historical_signal": (
            risk_result.get(
                "primary_historical_interval"
            )
        ),
        "ml_event_type_candidates": ml_candidates,
        "risk_class": risk_result[
            "fusion"
        ]["risk_class"],
        "final_risk_score": risk_result[
            "fusion"
        ]["final_score"],
    }

    generation = generate_rag_response(
        query=query,
        evidence=retrieval["evidence"],
    )

    # ---------------------------------------------------------
    # STEP 6 — Final unified response
    # ---------------------------------------------------------

    execution_reason = (
        "HIGH_RISK_AUTOMATIC"
        if trigger_result["rag_required"]
        else "FORCED_FOR_TESTING"
    )

    return {
        "well_id": well_id,
        "pipeline_status": "RAG_EXECUTED",
        "risk": risk_result,
        "trigger": {
            **trigger_result,
            "rag_execution_reason": execution_reason,
        },
        "rag": {
            "executed": True,
            "query": retrieval["query"],
            "retrieval": {
                "raw_result_count": retrieval[
                    "raw_result_count"
                ],
                "deduplicated_result_count": retrieval[
                    "result_count"
                ],
                "deduplication": retrieval[
                    "deduplication"
                ],
            },
            "evidence": retrieval["evidence"],
            "generation": generation,
            "traceability": {
                item["evidence_id"]: {
                    "well_id": item["well_id"],
                    "well_name": item["well_name"],
                    "event_type": item["event_type"],
                    "severity": item["severity"],
                    "depth_m": item["depth_m"],
                    "source_event_ids": item[
                        "source_event_ids"
                    ],
                    "source_documents": item[
                        "source_documents"
                    ],
                    "source_pages": item[
                        "source_pages"
                    ],
                    "source_extraction_methods": item[
                        "source_extraction_methods"
                    ],
                }
                for item in retrieval["evidence"]
            },
        },
    }