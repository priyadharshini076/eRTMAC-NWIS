from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
# ---------------------------------------------------------
# Make backend importable
# ---------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.services.ocr_service import extract_pdf
from app.services.extraction_service import (
    detect_document_type,
    extract_entities,
    extract_wcr_normal_events,
)


# ---------------------------------------------------------
# PDF
# ---------------------------------------------------------
PROJECT_ROOT = BACKEND_DIR.parent

PDF_PATH = (
    PROJECT_ROOT
    / "data"
    / "documents"
    / "wcr"
    / "OIL-BGJ-003_WCR.pdf"
)


print("=" * 70)
print("WCR EXTRACTION DEBUG")
print("=" * 70)

print("PDF:")
print(PDF_PATH)
print()


# ---------------------------------------------------------
# Check file
# ---------------------------------------------------------
if not PDF_PATH.exists():
    print("ERROR: PDF NOT FOUND")
    sys.exit(1)


# ---------------------------------------------------------
# Extract PDF
# ---------------------------------------------------------
extraction = extract_pdf(PDF_PATH)

print("Page count:", extraction["page_count"])
print("Text pages:", extraction["text_pages"])
print("OCR pages:", extraction["ocr_pages"])
print("Duplicate pages:", extraction["duplicate_pages"])
print()


# ---------------------------------------------------------
# Full text
# ---------------------------------------------------------
full_text = extraction["full_text"]

print("=" * 70)
print("DOCUMENT TYPE")
print("=" * 70)

document_type = detect_document_type(full_text)

print("Detected type:", document_type)
print()


# ---------------------------------------------------------
# Show event section
# ---------------------------------------------------------
upper = full_text.upper()

start = upper.find(
    "SIGNIFICANT HISTORICAL EVENTS"
)

if start == -1:
    start = upper.find(
        "SIGNIFICANT EVENTS"
    )

if start == -1:

    print("ERROR:")
    print("Historical event section NOT FOUND")

else:

    event_section = full_text[start:]

    completion_index = event_section.upper().find(
        "COMPLETION SUMMARY"
    )

    if completion_index != -1:

        event_section = event_section[
            :completion_index
        ]

    print("=" * 70)
    print("EVENT SECTION")
    print("=" * 70)

    print(event_section)
    print()


# ---------------------------------------------------------
# Direct entity extraction
# ---------------------------------------------------------
print("=" * 70)
print("ENTITY EXTRACTION")
print("=" * 70)

entities = extract_entities(
    full_text,
    document_type="WCR",
    expected_well_id="OIL-BGJ-003",
)


print("document_type:")
print(entities.get("document_type"))
print()

print("well_id:")
print(entities.get("well_id"))
print()

print("well_name:")
print(entities.get("well_name"))
print()

print("formation:")
print(entities.get("formation"))
print()

print("measured_depth_m:")
print(entities.get("measured_depth_m"))
print()

print("true_vertical_depth_m:")
print(entities.get("true_vertical_depth_m"))
print()

print("=" * 70)
print("EVENT RESULTS")
print("=" * 70)

# ---------------------------------------------------------
# DIRECT WCR EVENT PARSER TEST
# ---------------------------------------------------------

print("=" * 70)
print("DIRECT WCR EVENT PARSER")
print("=" * 70)

direct_events = extract_wcr_normal_events(
    full_text
)

print(
    "DIRECT EVENT COUNT:",
    len(direct_events)
)

print()

for index, event in enumerate(
    direct_events,
    start=1
):
    print(f"EVENT #{index}")
    print("-" * 50)
    print("date:", event.get("date"))
    print("depth_m:", event.get("depth_m"))
    print("event:", event.get("event"))
    print("event_type:", event.get("event_type"))
    print("severity:", event.get("severity"))
    print("details:", event.get("details"))
    print()


# ---------------------------------------------------------
# NORMAL ENTITY PIPELINE
# ---------------------------------------------------------

print("=" * 70)
print("ENTITY PIPELINE EVENT RESULTS")
print("=" * 70)

events = entities.get("events", [])

print(
    "ENTITY EVENT COUNT:",
    len(events)
)

print()

for index, event in enumerate(
    events,
    start=1
):
    print(f"ENTITY EVENT #{index}")
    print("-" * 50)
    print("date:", event.get("date"))
    print("depth_m:", event.get("depth_m"))
    print("event:", event.get("event"))
    print("event_type:", event.get("event_type"))
    print("severity:", event.get("severity"))
    print("details:", event.get("details"))
    print()
print()

for index, event in enumerate(events, start=1):

    print(f"EVENT #{index}")
    print("-" * 50)

    print("date:", event.get("date"))
    print("depth_m:", event.get("depth_m"))
    print("event:", event.get("event"))
    print("event_type:", event.get("event_type"))
    print("severity:", event.get("severity"))
    print("details:", event.get("details"))

    print()


print("=" * 70)
print("DEBUG COMPLETE")
print("=" * 70)