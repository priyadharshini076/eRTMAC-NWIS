from typing import Optional, Any
from fastapi import APIRouter, Depends, Query, Body, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User
from app.services.llm_service import generate_rag_response
from app.services.rag_service import (
    retrieve_rag_evidence,
    query_rag_chatbot,
    get_rag_quick_stats,
    parse_rag_query,
)


router = APIRouter(
    tags=["RAG"]
)


allow_roles = deps.RoleChecker(["drilling_engineer", "drilling_supervisor", "geologist", "well_planner", "admin"])


class RagChatQueryRequest(BaseModel):
    query: str = Field(..., description="User's natural language drilling query")
    well_id: Optional[str] = Field(None, description="Optional well identifier filter, e.g. OIL-DGB-001")
    formation: Optional[str] = Field(None, description="Optional target formation filter, e.g. Tipam or Barail")
    event_type: Optional[str] = Field(None, description="Optional event type filter, e.g. Mud Loss or Stuck Pipe")
    depth_m: Optional[float] = Field(None, description="Optional depth in meters")
    max_results: Optional[int] = Field(8, ge=1, le=25, description="Maximum evidence items to return")


@router.get("/rag/stats")
def get_knowledge_base_stats(
    db: Session = Depends(get_db)
):
    """
    Get live verified knowledge base statistics across all archival drilling events,
    formations, and documents in the eRTMAC-NWIS database.
    """
    return get_rag_quick_stats(db=db)


@router.post("/rag/query")
def submit_rag_chat_query(
    payload: RagChatQueryRequest,
    db: Session = Depends(get_db),
):
    """
    Dynamic Conversational RAG Chatbot Query Endpoint.
    Searches 2,000 verified archival document events and returns structured,
    grounded historical mitigations, lessons learned, and document citations.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")

    return query_rag_chatbot(
        db=db,
        query=payload.query.strip(),
        well_id=payload.well_id,
        formation=payload.formation,
        event_type=payload.event_type,
        depth_m=payload.depth_m,
        max_results=payload.max_results or 8,
    )


@router.get("/rag/query")
def get_rag_chat_query(
    query: str = Query(..., description="User query"),
    well_id: Optional[str] = Query(None, description="Optional well filter"),
    formation: Optional[str] = Query(None, description="Optional formation filter"),
    event_type: Optional[str] = Query(None, description="Optional event type"),
    depth_m: Optional[float] = Query(None, description="Optional depth in meters"),
    max_results: int = Query(8, ge=1, le=25),
    db: Session = Depends(get_db),
):
    """
    GET version of the RAG Chatbot Query Endpoint for quick URL queries.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")

    return query_rag_chatbot(
        db=db,
        query=query.strip(),
        well_id=well_id,
        formation=formation,
        event_type=event_type,
        depth_m=depth_m,
        max_results=max_results,
    )


@router.get(
    "/wells/{well_id}/rag-context"
)
def get_rag_context(
    well_id: str,
    current_depth: float,
    depth_window: float = Query(
        200,
        gt=0,
        le=1000,
    ),
    max_results: int = Query(
        8,
        ge=1,
        le=20,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_roles),
):
    return retrieve_rag_evidence(
        db=db,
        well_id=well_id,
        current_depth_m=current_depth,
        depth_window_m=depth_window,
        max_results=max_results,
    )


@router.get(
    "/wells/{well_id}/rag-analysis"
)
def get_rag_analysis(
    well_id: str,
    current_depth: float,
    depth_window: float = Query(
        200,
        gt=0,
        le=1000,
    ),
    max_results: int = Query(
        8,
        ge=1,
        le=20,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_roles),
):
    """
    Retrieve, deduplicate and generate a grounded RAG analysis for a specific well at a depth.
    """
    retrieval = retrieve_rag_evidence(
        db=db,
        well_id=well_id,
        current_depth_m=current_depth,
        depth_window_m=depth_window,
        max_results=max_results,
    )

    query = retrieval["query"]
    evidence = retrieval["evidence"]

    generation = generate_rag_response(
        query=query,
        evidence=evidence,
    )

    return {
        "well_id": well_id,
        "rag_query": query,
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
        "evidence": evidence,
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
            for item in evidence
        },
    }