from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.services.ocr_service import extract_pdf
from app.services.extraction_service import extract_entities
from app.services.validation_service import validate_extracted_data


PDF_PATH = Path(__file__).resolve().parents[2] / "data" / "documents" / "wcr" / "OIL-NHK-013_WCR.pdf"


def main():
    if not PDF_PATH.exists():
        print(f"ERROR: File not found: {PDF_PATH}")
        return

    result = extract_pdf(str(PDF_PATH))

    print("=" * 80)
    print("DOCUMENT")
    print("=" * 80)

    print(f"File: {result['file_name']}")
    print(f"Pages: {result['page_count']}")

    print("\n" + "=" * 80)
    print("PAGE EXTRACTION")
    print("=" * 80)

    for page in result["pages"]:
        page_number = page["page_number"]
        method = page["extraction_method"]
        confidence = page["confidence"]
        text = page["text"]

        print(f"\n--- PAGE {page_number} ---")
        print(f"Method: {method}")
        print(f"Confidence: {confidence}")
        print(f"Extracted characters: {len(text)}")

        print("\n--- COMPLETE PAGE TEXT ---")
        print(text)

    print("\n" + "=" * 80)
    print("COMPLETE DOCUMENT TEXT")
    print("=" * 80)

    full_text = result["full_text"]

    print(f"Total extracted characters: {len(full_text)}")
    print(full_text)

    print("\n" + "=" * 80)
    print("EXTRACTED ENTITIES")
    print("=" * 80)

    entities = extract_entities(full_text)

    for key, value in entities.items():
        print(f"{key}: {value}")

    print("\n" + "=" * 80)
    print("VALIDATION")
    print("=" * 80)

    validation = validate_extracted_data(entities)
    print(validation)

    # Save complete extracted text for inspection
    output_file = Path("data") / "extracted_OIL-NHK-013_WCR.txt"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    output_file.write_text(full_text, encoding="utf-8")

    print("\n" + "=" * 80)
    print("TEXT FILE SAVED")
    print("=" * 80)
    print(output_file.resolve())


if __name__ == "__main__":
    main()