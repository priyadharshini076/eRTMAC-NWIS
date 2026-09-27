from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.api import deps
from app.models.user import User
from app.services.llm_service import generate_rag_response
from app.services.rag_service import retrieve_rag_evidence


router = APIRouter(
    tags=["RAG"]
)


allow_roles = deps.RoleChecker(["drilling_engineer", "drilling_supervisor", "geologist", "well_planner", "admin"])

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
    Retrieve, deduplicate and generate a grounded RAG analysis.
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