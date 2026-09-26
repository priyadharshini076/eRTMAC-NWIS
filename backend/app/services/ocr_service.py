from pathlib import Path
from typing import Any
import hashlib

import cv2
import numpy as np
import pymupdf
import pytesseract
from PIL import Image


# =========================================================
# Tesseract configuration
# =========================================================

TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


# =========================================================
# Configuration
# =========================================================

MIN_TEXT_LENGTH = 40
OCR_DPI = 200


# =========================================================
# OCR helpers
# =========================================================

def render_page_to_image(
    page: Any,
    dpi: int = OCR_DPI,
) -> Image.Image:
    """
    Convert a PDF page into a PIL image for OCR.
    """

    zoom = dpi / 72

    matrix = pymupdf.Matrix(
        zoom,
        zoom,
    )

    pix = page.get_pixmap(
        matrix=matrix,
        alpha=False,
    )

    image = Image.frombytes(
        "RGB",
        [pix.width, pix.height],
        pix.samples,
    )

    return image


def preprocess_image(
    image: Image.Image,
) -> Image.Image:
    """
    Improve OCR quality using:

    1. RGB -> grayscale
    2. Gaussian blur
    3. Otsu thresholding
    """

    image_array = np.array(image)

    gray = cv2.cvtColor(
        image_array,
        cv2.COLOR_RGB2GRAY,
    )

    blurred = cv2.GaussianBlur(
        gray,
        (3, 3),
        0,
    )

    _, thresholded = cv2.threshold(
        blurred,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    return Image.fromarray(
        thresholded
    )


def perform_ocr(
    image: Image.Image,
) -> tuple[str, float | None]:
    """
    Run Tesseract OCR and calculate
    average word-level confidence.
    """

    processed = preprocess_image(
        image
    )

    data = pytesseract.image_to_data(
        processed,
        output_type=pytesseract.Output.DICT,
        config="--psm 6",
    )

    words: list[str] = []
    confidences: list[float] = []

    for text, confidence in zip(
        data["text"],
        data["conf"],
    ):
        text = text.strip()

        if not text:
            continue

        try:
            confidence_value = float(
                confidence
            )
        except (
            ValueError,
            TypeError,
        ):
            continue

        words.append(text)

        if confidence_value >= 0:
            confidences.append(
                confidence_value
            )

    extracted_text = " ".join(
        words
    ).strip()

    average_confidence = (
        sum(confidences)
        / len(confidences)
        if confidences
        else None
    )

    return (
        extracted_text,
        average_confidence,
    )


# =========================================================
# Duplicate detection helper
# =========================================================

def calculate_text_hash(
    text: str,
) -> str:
    """
    Calculate SHA-256 hash of page text.

    Used to identify pages whose extracted text
    is exactly duplicated.
    """

    normalized_text = text.strip()

    return hashlib.sha256(
        normalized_text.encode(
            "utf-8"
        )
    ).hexdigest()


# =========================================================
# Main extraction function
# =========================================================

def extract_pdf(
    file_path: str,
) -> dict[str, Any]:
    """
    Hybrid PDF extraction.

    Processing order:

    1. Try direct PyMuPDF text extraction.
    2. If insufficient text exists, use OCR.
    3. Detect duplicate pages.
    4. Keep all page records.
    5. Exclude duplicate page content from full_text.

    Returns:
        {
            "file_name": ...,
            "file_path": ...,
            "page_count": ...,
            "pages": [...],
            "full_text": ...
        }
    """

    pdf_path = Path(
        file_path
    )

    # -----------------------------------------------------
    # Validate file
    # -----------------------------------------------------

    if not pdf_path.exists():
        raise FileNotFoundError(
            f"PDF not found: {file_path}"
        )

    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(
            f"Expected a PDF file, got: "
            f"{pdf_path.suffix}"
        )

    # -----------------------------------------------------
    # Store page-level extraction
    # -----------------------------------------------------

    pages: list[dict[str, Any]] = []

    # -----------------------------------------------------
    # Open PDF
    # -----------------------------------------------------

    with pymupdf.open(
        pdf_path
    ) as document:

        for page_number, page in enumerate(
            document,
            start=1,
        ):

            # =============================================
            # First attempt:
            # Direct PDF text extraction
            # =============================================

            direct_text = (
                page
                .get_text("text")
                .strip()
            )

            if len(direct_text) >= MIN_TEXT_LENGTH:

                pages.append(
                    {
                        "page_number": page_number,
                        "text": direct_text,
                        "extraction_method": "text",
                        "confidence": None,
                        "is_duplicate": False,
                    }
                )

                continue

            # =============================================
            # Fallback:
            # OCR
            # =============================================

            image = render_page_to_image(
                page,
                dpi=OCR_DPI,
            )

            ocr_text, confidence = (
                perform_ocr(image)
            )

            pages.append(
                {
                    "page_number": page_number,
                    "text": ocr_text,
                    "extraction_method": "ocr",
                    "confidence": confidence,
                    "is_duplicate": False,
                }
            )

    # =====================================================
    # Duplicate page detection
    # =====================================================

    unique_texts: list[str] = []

    seen_hashes: set[str] = set()

    for page in pages:

        page_text = page[
            "text"
        ].strip()

        # -----------------------------------------------
        # Empty page
        # -----------------------------------------------

        if not page_text:
            page["is_duplicate"] = False
            continue

        # -----------------------------------------------
        # Calculate page hash
        # -----------------------------------------------

        content_hash = calculate_text_hash(
            page_text
        )

        # -----------------------------------------------
        # Duplicate
        # -----------------------------------------------

        if content_hash in seen_hashes:

            page["is_duplicate"] = True

            continue

        # -----------------------------------------------
        # First occurrence
        # -----------------------------------------------

        page["is_duplicate"] = False

        seen_hashes.add(
            content_hash
        )

        unique_texts.append(
            page_text
        )

    # =====================================================
    # Build complete document text
    # =====================================================

    full_text = "\n\n".join(
        unique_texts
    )

    # =====================================================
    # Statistics
    # =====================================================

    duplicate_pages = [
        page["page_number"]
        for page in pages
        if page.get(
            "is_duplicate",
            False,
        )
    ]

    text_pages = sum(
        1
        for page in pages
        if page[
            "extraction_method"
        ] == "text"
    )

    ocr_pages = sum(
        1
        for page in pages
        if page[
            "extraction_method"
        ] == "ocr"
    )

    # =====================================================
    # Return
    # =====================================================

    return {
        "file_name": pdf_path.name,
        "file_path": str(pdf_path),
        "page_count": len(pages),
        "pages": pages,
        "full_text": full_text,
        "text_pages": text_pages,
        "ocr_pages": ocr_pages,
        "duplicate_pages": duplicate_pages,
        "duplicate_page_count": len(
            duplicate_pages
        ),
    }