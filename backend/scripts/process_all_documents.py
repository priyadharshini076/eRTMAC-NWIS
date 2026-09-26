from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
import json
import time

from sqlalchemy import select

from app.database.session import SessionLocal
from app.models.document import Document
from app.services.document_processing_service import (
    process_document,
)


BACKEND_DIR = Path(
    __file__
).resolve().parent.parent

REPORT_DIR = (
    BACKEND_DIR
    / "data"
    / "reports"
)

REPORT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


def resolve_file_path(
    file_path: str,
) -> Path:

    path = Path(file_path)

    if path.is_absolute():
        return path

    return BACKEND_DIR / path


def main():

    db = SessionLocal()

    results = []

    try:

        documents = db.scalars(
            select(Document)
            .order_by(Document.id)
        ).all()

        print("=" * 80)
        print(
            "eRTMAC-NWIS DOCUMENT BATCH PROCESSING"
        )
        print("=" * 80)

        print(
            f"Documents found: {len(documents)}"
        )

        for index, document in enumerate(
            documents,
            start=1,
        ):

            start_time = time.time()

            file_path = resolve_file_path(
                document.file_path
            )

            result_row = {
                "document_id": document.id,
                "well_id_metadata": document.well_id,
                "file_name": document.file_name,
                "document_type": document.document_type,
                "file_path": str(file_path),
                "success": False,
                "error": None,
                "page_count": 0,
                "text_pages": 0,
                "ocr_pages": 0,
                "well_extracted": False,
                "well_id_source": None,
                "formation_extracted": False,
                "event_count": 0,
                "validation_valid": False,
                "validation_warnings": [],
                "processing_seconds": 0,
            }

            print(
                f"\n[{index}/{len(documents)}] "
                f"{document.file_name}"
            )

            if not file_path.exists():

                result_row["error"] = (
                    f"File not found: {file_path}"
                )

                print(
                    f"  ERROR: "
                    f"{result_row['error']}"
                )

                results.append(
                    result_row
                )

                continue

            try:

                result = process_document(
                    db=db,
                    file_path=str(
                        file_path
                    ),
                )

                extraction_methods = (
                    result[
                        "extraction_methods"
                    ]
                )

                text_pages = (
                    extraction_methods.count(
                        "text"
                    )
                )

                ocr_pages = (
                    extraction_methods.count(
                        "ocr"
                    )
                )

                validation = result.get(
                    "validation",
                    {},
                )

                result_row.update({
                    "success": True,
                    "page_count": result[
                        "page_count"
                    ],
                    "text_pages": text_pages,
                    "ocr_pages": ocr_pages,
                    "well_extracted": bool(
                        result.get(
                            "well_id"
                        )
                    ),
                    "well_id_source": result.get(
                        "well_id_source"
                    ),
                    "formation_extracted": bool(
                        result.get(
                            "formation"
                        )
                    ),
                    "event_count": result.get(
                        "event_count",
                        0,
                    ),
                    "validation_valid": validation.get(
                        "valid",
                        False,
                    ),
                    "validation_warnings": validation.get(
                        "warnings",
                        [],
                    ),
                })

                print(
                    f"  OK | "
                    f"{result['document_type']} | "
                    f"pages={result_row['page_count']} | "
                    f"text={text_pages} | "
                    f"ocr={ocr_pages} | "
                    f"well={result_row['well_extracted']} | "
                    f"formation={result_row['formation_extracted']} | "
                    f"events={result_row['event_count']}"
                )

            except Exception as exc:

                db.rollback()

                result_row["error"] = (
                    f"{type(exc).__name__}: "
                    f"{exc}"
                )

                print(
                    f"  ERROR: "
                    f"{result_row['error']}"
                )

            result_row[
                "processing_seconds"
            ] = round(
                time.time()
                - start_time,
                3,
            )

            results.append(
                result_row
            )

    finally:
        db.close()

    # =====================================================
    # Summary
    # =====================================================

    total = len(results)

    successful = sum(
        1
        for r in results
        if r["success"]
    )

    failed = total - successful

    wcr_count = sum(
        1
        for r in results
        if r["document_type"] == "WCR"
    )

    ddr_count = sum(
        1
        for r in results
        if r["document_type"] == "DDR"
    )

    text_pages = sum(
        r["text_pages"]
        for r in results
    )

    ocr_pages = sum(
        r["ocr_pages"]
        for r in results
    )

    missing_well = sum(
        1
        for r in results
        if r["success"]
        and not r["well_extracted"]
    )

    metadata_fallback_well = sum(
        1
        for r in results
        if r["well_id_source"]
        == "metadata_fallback"
    )

    missing_formation = sum(
        1
        for r in results
        if r["success"]
        and not r["formation_extracted"]
    )

    total_events = sum(
        r["event_count"]
        for r in results
    )

    documents_with_warnings = sum(
        1
        for r in results
        if r["validation_warnings"]
    )

    summary = {
        "total_documents": total,
        "successful": successful,
        "failed": failed,
        "wcr_documents": wcr_count,
        "ddr_documents": ddr_count,
        "text_pages": text_pages,
        "ocr_pages": ocr_pages,
        "missing_well_id": missing_well,
        "metadata_fallback_well_id":
            metadata_fallback_well,
        "missing_formation":
            missing_formation,
        "total_extracted_events":
            total_events,
        "documents_with_validation_warnings":
            documents_with_warnings,
    }

    report = {
        "summary": summary,
        "documents": results,
    }

    output_file = (
        REPORT_DIR
        / "document_processing_report.json"
    )

    output_file.write_text(
        json.dumps(
            report,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

    print("\n" + "=" * 80)
    print(
        "BATCH PROCESSING COMPLETE"
    )
    print("=" * 80)

    for key, value in summary.items():
        print(
            f"{key}: {value}"
        )

    print("\nReport:")
    print(output_file)


if __name__ == "__main__":
    main()
