from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.database.session import SessionLocal
from app.models.document import Document
from app.services.ocr_service import extract_pdf


FILES_TO_INSPECT = [
    "OIL-BGJ-001_WCR.pdf",
    "OIL-BGJ-003_WCR.pdf",
    "OIL-BGJ-001_DDR.pdf",
    "OIL-BGJ-003_DDR.pdf",
]


def main():
    db = SessionLocal()

    try:
        for file_name in FILES_TO_INSPECT:

            document = (
                db.query(Document)
                .filter(
                    Document.file_name == file_name
                )
                .first()
            )

            print("\n" + "=" * 80)
            print(file_name)
            print("=" * 80)

            if document is None:
                print("Document metadata not found")
                continue

            print(f"DB document_id : {document.id}")
            print(f"DB well_id     : {document.well_id}")
            print(f"DB type        : {document.document_type}")
            print(f"DB path        : {document.file_path}")

            pdf_path = Path(document.file_path)

            if not pdf_path.exists():
                print(f"FILE NOT FOUND: {pdf_path}")
                continue

            result = extract_pdf(str(pdf_path))

            print(f"Pages: {result['page_count']}")

            for page in result["pages"]:
                print("\n" + "-" * 80)
                print(f"PAGE {page['page_number']}")
                print(f"METHOD: {page['extraction_method']}")
                print(f"CONFIDENCE: {page['confidence']}")
                print("-" * 80)

                print(page["text"])

    finally:
        db.close()


if __name__ == "__main__":
    main()