from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.database.session import SessionLocal
from app.services.document_processing_service import process_document


PDF_PATH = Path(__file__).resolve().parents[2] / "data" / "documents" / "wcr" / "OIL-DGB-002_WCR.pdf"


def main():
    db = SessionLocal()

    try:
        result = process_document(
            db=db,
            file_path=str(PDF_PATH),
        )

        print("=" * 70)
        print("DOCUMENT PROCESSED SUCCESSFULLY")
        print("=" * 70)

        for key, value in result.items():
            print(f"{key}: {value}")

    except Exception as exc:
        db.rollback()

        print("=" * 70)
        print("DOCUMENT PROCESSING FAILED")
        print("=" * 70)
        print(type(exc).__name__)
        print(str(exc))

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()