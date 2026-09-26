from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


KNOWN_EVENT_TYPES = [
    "Stuck Pipe",
    "Mud Loss",
    "Torque Spike",
    "Pressure Spike",
    "Fishing Operation",
    "Cementing Issue",
    "Kick",
    "NPT",
]

ALLOWED_SEVERITIES = {"Critical", "High", "Medium", "Low"}
ALLOWED_FORMATIONS = {
    "Girujan",
    "Tipam",
    "Barail",
    "Kopili",
    "Lakadong+Therria",
}

DATE_RE = re.compile(r"\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b")
NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")


# ============================================================
# Basic cleanup
# ============================================================


def normalize_whitespace(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\x00", " ")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def normalize_ocr_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\ufeff", "")
    value = value.replace("–", "-").replace("—", "-")
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    value = re.sub(r"[ \t]+", " ", value)
    return value.strip()


def clean_ocr_event_boundaries(text: str) -> str:
    """
    Fix OCR punctuation accidentally attached to event names
    immediately before the pipe separator.

    Example:
        NPT {| High | 927 m
    becomes:
        NPT | High | 927 m
    """
    if not text:
        return text

    return re.sub(
        r"\b(Mud Loss|Torque Spike|Stuck Pipe|NPT|Kick|Fishing Operation)"
        r"\s*[\{\}\[\]<>]+\s*(?=\|)",
        r"\1 ",
        text,
        flags=re.IGNORECASE,
    )


def clean_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = normalize_ocr_text(value)
    value = value.strip(" \t\r\n:;-|")
    return value or None


# ============================================================
# Normalizers
# ============================================================


def normalize_well_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = clean_value(value)
    if not value:
        return None

    value = re.sub(r"[\{\}\[\]<>]", "", value)
    value = re.sub(r"\s+", " ", value)

    # Standard: OIL-BGJ-001
    m = re.search(
        r"\b(OIL)[-\s_/]*([A-Z0-9]{2,8})[-\s_/]*(\d{2,5})\b",
        value,
        flags=re.I,
    )
    if m:
        return f"{m.group(1).upper()}-{m.group(2).upper()}-{m.group(3).zfill(3)}"

    # OCR variant such as OIL-BG}001
    m = re.search(
        r"\bOIL[-\s_/]*([A-Z]{2,8})[^A-Z0-9]{0,3}(\d{2,5})\b",
        value,
        flags=re.I,
    )
    if m:
        return f"OIL-{m.group(1).upper()}-{m.group(2).zfill(3)}"

    return value


def normalize_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = clean_value(value)
    if not value:
        return None

    value = value.replace("/", "-")
    m = DATE_RE.search(value)
    if not m:
        return value

    raw = m.group(0)
    try:
        return datetime.strptime(raw, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return raw


def normalize_formation(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    value = clean_value(value)
    if not value:
        return None

    value = re.sub(r"[\{\}\[\]<>]", "", value)
    value = re.sub(r"\s*\([^)]*\)", "", value)

    value = re.split(
        r"\s+(?:"
        r"Report\s+Timestamp|"
        r"Current\s+Depth|"
        r"Latest\s+Alert|"
        r"Recent\s+Parameters|"
        r"Recent\s+Drilling\s+Parameters|"
        r"Spud\s*/\s*Completion|"
        r"Measured\s*/\s*TVD|"
        r"Measured\s+Depth|"
        r"True\s+Vertical\s+Depth|"
        r"Formation\s+Interval|"
        r"Lithology|"
        r"Mud\s+System|"
        r"Operational\s+Events|"
        r"Significant\s+Events|"
        r"Significant\s+Historical\s+Events"
        r")\b",
        value,
        maxsplit=1,
        flags=re.I,
    )[0]

    value = clean_value(value)
    if not value:
        return None

    compact = value.lower().replace(" ", "")
    mapping = {
        "girujan": "Girujan",
        "girujanformation": "Girujan",
        "tipam": "Tipam",
        "barail": "Barail",
        "kopili": "Kopili",
        "lakadong+therria": "Lakadong+Therria",
        "lakadongandtherria": "Lakadong+Therria",
    }
    if compact in mapping:
        return mapping[compact]

    for formation in ALLOWED_FORMATIONS:
        if value.lower().startswith(formation.lower()):
            return formation

    return value


def normalize_event_type(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = clean_value(value)
    if not value:
        return None

    value = re.sub(r"[\{\}\[\]<>]+$", "", value)
    compact = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    mapping = {
        "stuck pipe": "Stuck Pipe",
        "mud loss": "Mud Loss",
        "torque spike": "Torque Spike",
        "pressure spike": "Pressure Spike",
        "fishing operation": "Fishing Operation",
        "cementing issue": "Cementing Issue",
        "kick": "Kick",
        "npt": "NPT",
    }
    if compact in mapping:
        return mapping[compact]

    for event_type in KNOWN_EVENT_TYPES:
        if compact.startswith(event_type.lower()):
            return event_type

    return value.strip(" :;,.|-")


def normalize_severity(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = clean_value(value)
    if not value:
        return None

    compact = value.lower()
    for severity in ALLOWED_SEVERITIES:
        if re.search(rf"\b{severity.lower()}\b", compact):
            return severity
    return value.title()


# ============================================================
# Document type
# ============================================================


def detect_document_type(text: str, document_type: Optional[str] = None) -> str:
    if document_type:
        value = str(document_type).strip().lower()
        if value in {"wcr", "wcr.pdf", "well completion report"}:
            return "WCR"
        if value in {"ddr", "ddr.pdf", "daily drilling report"}:
            return "DDR"

    upper = (text or "").upper()
    if "WELL COMPLETION REPORT" in upper or "SIGNIFICANT HISTORICAL EVENTS" in upper:
        return "WCR"
    if (
        "DAILY DRILLING REPORT" in upper
        or "OPERATIONAL EVENTS / LESSONS" in upper
        or "OPERATIONAL EVENTS" in upper
        or "RECENT DRILLING PARAMETERS" in upper
    ):
        return "DDR"
    return "WCR"


# ============================================================
# Generic field helpers
# ============================================================


def extract_label(text: str, labels: List[str]) -> Optional[str]:
    if not text:
        return None

    lines = [line.strip() for line in text.splitlines()]
    label_pattern = "|".join(re.escape(label) for label in labels)

    for line in lines:
        m = re.match(
            rf"^(?:{label_pattern})\s*[:\-]?\s*(.+?)\s*$",
            line,
            flags=re.I,
        )
        if m:
            return clean_value(m.group(1))

    m = re.search(
        rf"(?:{label_pattern})\s*[:\-]\s*([^\n]+)",
        text,
        flags=re.I,
    )
    return clean_value(m.group(1)) if m else None


def extract_number(text: str, labels: List[str]) -> Optional[float]:
    value = extract_label(text, labels)
    if value is None:
        return None

    m = NUMBER_RE.search(value)
    if not m:
        return None

    try:
        return float(m.group(0))
    except ValueError:
        return None


def extract_well_id(text: str, expected_well_id: Optional[str] = None) -> Optional[str]:
    # Prefer explicit Well ID.
    value = extract_label(text, ["Well ID", "Well No", "Well Number"])
    if value:
        normalized = normalize_well_id(value)
        if normalized and normalized.startswith("OIL-"):
            return normalized

    # Header and global fallback.
    m = re.search(
        r"\bOIL[-\s_/]*[A-Z0-9]{2,8}[-\s_/]*\d{2,5}\b",
        text or "",
        flags=re.I,
    )
    if m:
        return normalize_well_id(m.group(0))

    if expected_well_id:
        return normalize_well_id(expected_well_id)
    return None


def extract_well_name(text: str) -> Optional[str]:
    if not text:
        return None

    # Explicit OCR/normal field. Bounded so it does not consume the rest
    # of a one-line OCR page.
    m = re.search(
        r"Well\s+Name\s*[:\-]?\s*(.+?)"
        r"(?=\s+(?:Field\s*/\s*District|Field\s*/\s*Formation|"
        r"Formation|Spud\s*/\s*Completion|Measured\s*/\s*TVD|"
        r"Measured\s+Depth|Report\s+Timestamp|Current\s+Depth|"
        r"Latest\s+Alert|Recent\s+Parameters|Recent\s+Drilling\s+Parameters|"
        r"NWIS\s+Well\s+Risk|Well\s+Risk|SIGNIFICANT\s+EVENTS|"
        r"Operational\s+Events|$))",
        text,
        flags=re.I | re.S,
    )
    if m:
        return clean_value(m.group(1))

    # Header: OIL-BGJ-003 - Baghjan-003
    m = re.search(
        r"\bOIL[-\s_/]*[A-Z0-9]{2,8}[-\s_/]*\d{2,5}\s*[-–—]\s*"
        r"([^\n]+?)(?=\s+(?:NWIS|API\s+Number|Field|Well\s+ID|Formation)\b|$)",
        text,
        flags=re.I | re.S,
    )
    if m:
        return clean_value(m.group(1))

    return None


# ============================================================
# Formation extraction
# ============================================================


def extract_formation(text: str) -> Optional[str]:
    if not text:
        return None

    text = normalize_ocr_text(text)
    stop = (
        r"(?=\s*(?:"
        r"Report\s+Timestamp|"
        r"Current\s+Depth|"
        r"Latest\s+Alert|"
        r"Recent\s+Parameters|"
        r"Recent\s+Drilling\s+Parameters|"
        r"Spud\s*/\s*Completion|"
        r"Measured\s*/\s*TVD|"
        r"Measured\s+Depth|"
        r"True\s+Vertical\s+Depth|"
        r"Formation\s+Interval|"
        r"Lithology|"
        r"Mud\s+System|"
        r"Operational\s+Events|"
        r"Significant\s+Events|"
        r"Significant\s+Historical\s+Events"
        r")\b|$)"
    )

    patterns = [
        rf"Field\s*/\s*Formation\s*[:\-]?\s*[^/\n]+\s*/\s*(.+?){stop}",
        rf"Formation\s*[:\-]?\s*(.+?){stop}",
        rf"\bFormation\s+(.+?){stop}",
    ]

    for pattern in patterns:
        m = re.search(pattern, text, flags=re.I | re.S)
        if m:
            normalized = normalize_formation(m.group(1))
            if normalized:
                return normalized

    # OCR fallback.
    m = re.search(
        r"(?:Formation|Field\s*/\s*Formation).{0,160}?"
        r"\b(Girujan|Tipam|Barail|Kopili|Lakadong\s*\+\s*Therria)\b",
        text,
        flags=re.I | re.S,
    )
    if m:
        return normalize_formation(m.group(1))

    return None


# ============================================================
# WCR metadata
# ============================================================


def extract_wcr_metadata(text: str, expected_well_id: Optional[str] = None) -> Dict[str, Any]:
    well_id = extract_well_id(text, expected_well_id=expected_well_id)
    well_name = extract_well_name(text)
    formation = extract_formation(text)

    measured_depth = None
    tvd = None

    # Supports:
    # Measured / TVD: 2316 m / 2287 m
    # Measured depth / TVD: 2906 m/ 2852 m
    m = re.search(
        r"(?:Measured\s+Depth|Measured)\s*/\s*"
        r"(?:TVD|True\s+Vertical\s+Depth)\s*[:\-]?\s*"
        r"(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?\s*/\s*"
        r"(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?",
        text,
        flags=re.I,
    )
    if m:
        measured_depth = float(m.group(1))
        tvd = float(m.group(2))
    else:
        measured_depth = extract_number(text, ["Measured Depth", "Measured depth"])
        tvd = extract_number(text, ["TVD", "True Vertical Depth"])

    # OCR may have "Measured depth / TVD" with unexpected spacing.
    if measured_depth is None:
        m = re.search(
            r"Measured\s+depth\s*/\s*TVD\s*[:\-]?\s*"
            r"(\d+(?:\.\d+)?)\s*m?\s*/\s*"
            r"(\d+(?:\.\d+)?)\s*m?",
            text,
            flags=re.I,
        )
        if m:
            measured_depth = float(m.group(1))
            tvd = float(m.group(2))

    return {
        "well_id": well_id,
        "well_name": well_name,
        "formation": formation,
        "measured_depth_m": measured_depth,
        "tvd_m": tvd,
    }


# ============================================================
# Common event helpers
# ============================================================


def _is_date_line(line: str) -> bool:
    return bool(DATE_RE.fullmatch((line or "").strip()))


def _is_depth_line(line: str) -> bool:
    value = (line or "").strip().replace(",", "")
    value = re.sub(r"\s*m$", "", value, flags=re.I)
    return bool(re.fullmatch(r"\d+(?:\.\d+)?", value))


def _looks_like_severity(line: str) -> bool:
    return normalize_severity(line) in ALLOWED_SEVERITIES


def _cleanup_detail_lines(lines: List[str]) -> str:
    values: List[str] = []
    for line in lines:
        value = clean_value(line)
        if not value:
            continue
        if re.match(r"^(?:Completion\s+Summary|Summary|Document\s+Summary|END\s+OF\s+REPORT)\b", value, flags=re.I):
            break
        values.append(value)
    return " ".join(values).strip()


# ============================================================
# WCR event parsing
# ============================================================


def _parse_wcr_event_block(lines: List[str], start_index: int) -> Tuple[Optional[Dict[str, Any]], int]:
    n = len(lines)
    i = start_index

    if i >= n or not _is_date_line(lines[i]):
        return None, start_index + 1

    event_date = normalize_date(lines[i])
    i += 1

    while i < n and not lines[i].strip():
        i += 1
    if i >= n or not _is_depth_line(lines[i]):
        return None, start_index + 1

    depth_raw = re.sub(r"\s*m$", "", lines[i].strip(), flags=re.I)
    depth_m = float(depth_raw)
    i += 1

    while i < n and not lines[i].strip():
        i += 1
    if i >= n:
        return None, start_index + 1

    event_type = normalize_event_type(lines[i])
    if event_type not in KNOWN_EVENT_TYPES:
        return None, start_index + 1
    i += 1

    while i < n and not lines[i].strip():
        i += 1

    severity = None
    if i < n and _looks_like_severity(lines[i]):
        severity = normalize_severity(lines[i])
        i += 1

    detail_lines: List[str] = []
    while i < n:
        current = lines[i].strip()
        if _is_date_line(current):
            break
        if re.match(
            r"^(?:Completion\s+Summary|Summary|Document\s+Summary|REMARKS|END\s+OF\s+REPORT)\b",
            current,
            flags=re.I,
        ):
            break
        if current:
            detail_lines.append(current)
        i += 1

    return {
        "event_date": event_date,
        "depth_m": depth_m,
        "event_type": event_type,
        "severity": severity,
        "details": _cleanup_detail_lines(detail_lines) or None,
    }, i


def extract_wcr_events(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []

    lines = [line.strip() for line in normalize_ocr_text(text).splitlines()]
    section_start = 0

    for idx, line in enumerate(lines):
        upper = line.upper()
        if "SIGNIFICANT HISTORICAL EVENTS" in upper or "SIGNIFICANT EVENTS" in upper:
            section_start = idx + 1
            break

    events: List[Dict[str, Any]] = []
    i = section_start
    while i < len(lines):
        if _is_date_line(lines[i]):
            event, next_i = _parse_wcr_event_block(lines, i)
            if event:
                events.append(event)
                i = next_i
                continue
        i += 1

    return deduplicate_events(events)


def extract_wcr_pipe_events(text: str) -> List[Dict[str, Any]]:
    """
    Parse compact scanned-WCR rows:
        2014-02-04 | Mud Loss | Critical | 2466 m Observation: ...
        2014-02-09 | Stuck Pipe | Critical | 2731 m Observation: ...
    """
    if not text:
        return []

    event_names = (
        r"Stuck\s+Pipe|Mud\s+Loss|Torque\s+Spike|Pressure\s+Spike|"
        r"Fishing\s+Operation|Cementing\s+Issue|Kick|NPT"
    )
    severities = r"Critical|High|Medium|Low"

    pattern = re.compile(
        rf"(?P<date>(?:19|20)\d{{2}}[-/]\d{{1,2}}[-/]\d{{1,2}})"
        rf"\s*\|\s*"
        rf"(?P<event>{event_names})"
        rf"\s*\|\s*"
        rf"(?P<severity>{severities})"
        rf"\s*\|\s*"
        rf"(?P<depth>\d+(?:\.\d+)?)\s*m?"
        rf"\s*"
        rf"(?P<details>.*?)"
        rf"(?="
        rf"(?:19|20)\d{{2}}[-/]\d{{1,2}}[-/]\d{{1,2}}\s*\|\s*"
        rf"|\bCompletion\s+Summary\b"
        rf"|$"
        rf")",
        flags=re.I | re.S,
    )

    events: List[Dict[str, Any]] = []
    for m in pattern.finditer(normalize_ocr_text(text)):
        events.append(
            {
                "event_date": normalize_date(m.group("date")),
                "depth_m": float(m.group("depth")),
                "event_type": normalize_event_type(m.group("event")),
                "severity": normalize_severity(m.group("severity")),
                "details": clean_value(m.group("details")),
            }
        )
    return deduplicate_events(events)


def extract_wcr_events_ocr(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []

    # Compact pipe-delimited OCR is the primary scanned-WCR format.
    pipe_events = extract_wcr_pipe_events(text)
    if pipe_events:
        return pipe_events

    normalized = normalize_ocr_text(text)
    event_names = (
        r"Stuck\s+Pipe|Mud\s+Loss|Torque\s+Spike|Pressure\s+Spike|"
        r"Fishing\s+Operation|Cementing\s+Issue|Kick|NPT"
    )
    pattern = re.compile(
        rf"(?P<date>(?:19|20)\d{{2}}[-/]\d{{1,2}}[-/]\d{{1,2}})"
        rf"\s+(?P<depth>\d+(?:\.\d+)?)\s*m?"
        rf"\s+(?P<event>{event_names})"
        rf"\s+(?P<severity>Critical|High|Medium|Low)"
        rf"\s*(?P<details>.*?)"
        rf"(?=(?:19|20)\d{{2}}[-/]\d{{1,2}}[-/]\d{{1,2}}|\bCompletion\s+Summary\b|$)",
        flags=re.I | re.S,
    )

    events: List[Dict[str, Any]] = []
    for m in pattern.finditer(normalized):
        events.append(
            {
                "event_date": normalize_date(m.group("date")),
                "depth_m": float(m.group("depth")),
                "event_type": normalize_event_type(m.group("event")),
                "severity": normalize_severity(m.group("severity")),
                "details": clean_value(m.group("details")),
            }
        )
    return deduplicate_events(events)


def extract_wcr_events_unified(text: str) -> List[Dict[str, Any]]:
    # Normal text parser first for true multiline WCRs.
    normal_events = extract_wcr_events(text)
    if normal_events:
        return normal_events

    # OCR/compact parser second.
    return extract_wcr_events_ocr(text)


# ============================================================
# DDR metadata and event parsing
# ============================================================


def extract_ddr_metadata(text: str, expected_well_id: Optional[str] = None) -> Dict[str, Any]:
    well_id = extract_well_id(text, expected_well_id=expected_well_id)
    well_name = extract_well_name(text)
    formation = extract_formation(text)

    report_timestamp = None
    current_depth_m = extract_number(text, ["Current Depth", "Current depth"])
    latest_alert = extract_label(text, ["Latest Alert", "Latest alert"])

    # Inline OCR fallback.
    if current_depth_m is None:
        m = re.search(
            r"Current\s+Depth\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:m|meter(?:s)?)?",
            text,
            flags=re.I,
        )
        if m:
            current_depth_m = float(m.group(1))

    m = re.search(
        r"Report\s+Timestamp\s*[:\-]?\s*([^\n]+?)(?=\s+Current\s+Depth\b|\s+Latest\s+Alert\b|$)",
        text,
        flags=re.I,
    )
    if m:
        report_timestamp = clean_value(m.group(1))

    return {
        "well_id": well_id,
        "well_name": well_name,
        "formation": formation,
        "report_timestamp": report_timestamp,
        "current_depth_m": current_depth_m,
        "latest_alert": latest_alert,
    }


def _extract_recent_parameters(text: str) -> Dict[str, Any]:
    # The current project mainly needs event + metadata extraction. Keep a
    # lightweight parser for the recent parameter section.
    result: Dict[str, Any] = {}
    match = re.search(
        r"(?:RECENT PARAMETERS|RECENT DRILLING PARAMETERS)\s*:?\s*(.*?)(?="
        r"\bOPERATIONAL\s+EVENTS\b|\bRECENT\s+LESSONS\b|\bLESSONS\b|$)",
        text,
        flags=re.I | re.S,
    )
    if not match:
        return result

    section = normalize_whitespace(match.group(1))
    # Store raw section rather than inventing a schema for it.
    if section:
        result["raw"] = section
    return result


def _extract_recent_lessons(text: str) -> List[str]:
    match = re.search(
        r"(?:RECENT LESSONS|LESSONS)\s*:?\s*(.*?)(?=\bEND\s+OF\s+REPORT\b|$)",
        text,
        flags=re.I | re.S,
    )
    if not match:
        return []

    section = normalize_whitespace(match.group(1))
    if not section:
        return []

    return [part.strip() for part in re.split(r"\s{2,}|\n", section) if part.strip()]


def extract_ddr_compact_events(text: str) -> List[Dict[str, Any]]:
    """
    Actual DDR synthetic format:
        Mud Loss (Medium) at 1116 m: Mud Loss at 1116 m in Girujan. ...
        Torque Spike (Medium) at 1845 m: ...
        Torque Spike (High) at 2106 m: ...
        Stuck Pipe (Critical) at 2122 m: ...
    """
    if not text:
        return []

    event_names = (
        r"Stuck\s+Pipe|Mud\s+Loss|Torque\s+Spike|Pressure\s+Spike|"
        r"Fishing\s+Operation|Cementing\s+Issue|Kick|NPT"
    )
    severities = r"Critical|High|Medium|Low"

    # Event starts are unambiguous because they contain (severity) at depth m:
    # Use a lookahead to keep each event's details bounded.
    pattern = re.compile(
        rf"(?P<event>{event_names})\s*"
        rf"\((?P<severity>{severities})\)\s+at\s+"
        rf"(?P<depth>\d+(?:\.\d+)?)\s*m\s*:\s*"
        rf"(?P<details>.*?)"
        rf"(?=(?:{event_names})\s*\((?:{severities})\)\s+at\s+\d+(?:\.\d+)?\s*m\s*:|$)",
        flags=re.I | re.S,
    )

    events: List[Dict[str, Any]] = []
    for m in pattern.finditer(text):
        details = clean_value(m.group("details"))
        date_match = DATE_RE.search(details or "")
        event_date = normalize_date(date_match.group(0)) if date_match else None

        events.append(
            {
                "event_date": event_date,
                "depth_m": float(m.group("depth")),
                "event_type": normalize_event_type(m.group("event")),
                "severity": normalize_severity(m.group("severity")),
                "details": details,
            }
        )

    return deduplicate_events(events)


def extract_ddr_events(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []

    normalized = normalize_ocr_text(text)

    # Locate Operational Events section.
    section_match = re.search(
        r"OPERATIONAL\s+EVENTS(?:\s*/\s*LESSONS)?",
        normalized,
        flags=re.I,
    )
    if section_match:
        section_text = normalized[section_match.end():]
        # Remove footer only; do not remove event detail text.
        section_text = re.split(
            r"\bThis\s+DDR\s+is\s+generated\b|\bEND\s+OF\s+REPORT\b",
            section_text,
            maxsplit=1,
            flags=re.I,
        )[0]

        compact_events = extract_ddr_compact_events(section_text)
        if compact_events:
            return compact_events

    # Fallback multiline format.
    lines = [line.strip() for line in normalized.splitlines()]
    section_start = None
    for idx, line in enumerate(lines):
        if "OPERATIONAL EVENTS" in line.upper():
            section_start = idx + 1
            break
    if section_start is None:
        return []

    events: List[Dict[str, Any]] = []
    i = section_start
    while i < len(lines):
        line = lines[i]
        if re.match(r"^(?:RECENT LESSONS|LESSONS|END OF REPORT|SUMMARY)\b", line, flags=re.I):
            break

        if not _is_date_line(line):
            i += 1
            continue

        event_date = normalize_date(line)
        i += 1

        while i < len(lines) and not lines[i]:
            i += 1
        if i >= len(lines) or not _is_depth_line(lines[i]):
            continue

        depth_m = float(re.sub(r"\s*m$", "", lines[i], flags=re.I))
        i += 1

        while i < len(lines) and not lines[i]:
            i += 1
        if i >= len(lines):
            break

        event_type = normalize_event_type(lines[i])
        if event_type not in KNOWN_EVENT_TYPES:
            continue
        i += 1

        while i < len(lines) and not lines[i]:
            i += 1

        severity = None
        if i < len(lines) and _looks_like_severity(lines[i]):
            severity = normalize_severity(lines[i])
            i += 1

        details: List[str] = []
        while i < len(lines):
            if _is_date_line(lines[i]):
                break
            if re.match(r"^(?:RECENT LESSONS|LESSONS|END OF REPORT|SUMMARY)\b", lines[i], flags=re.I):
                break
            if lines[i]:
                details.append(lines[i])
            i += 1

        events.append(
            {
                "event_date": event_date,
                "depth_m": depth_m,
                "event_type": event_type,
                "severity": severity,
                "details": _cleanup_detail_lines(details) or None,
            }
        )

    return deduplicate_events(events)


# ============================================================
# Deduplication
# ============================================================


def deduplicate_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    result: List[Dict[str, Any]] = []

    for event in events:
        normalized_event = dict(event)
        normalized_event["event_type"] = normalize_event_type(event.get("event_type"))
        normalized_event["severity"] = normalize_severity(event.get("severity"))
        normalized_event["details"] = clean_value(event.get("details"))

        key = (
            normalized_event.get("event_date"),
            normalized_event.get("depth_m"),
            normalized_event.get("event_type"),
            normalized_event.get("severity"),
            normalized_event.get("details") or "",
        )

        if key in seen:
            continue
        seen.add(key)
        result.append(normalized_event)

    return result


# ============================================================
# Entity extraction
# ============================================================


def extract_wcr_entities(text: str, expected_well_id: Optional[str] = None) -> Dict[str, Any]:
    metadata = extract_wcr_metadata(text, expected_well_id=expected_well_id)
    events = extract_wcr_events_unified(text)
    return {
        **metadata,
        "metadata": metadata,
        "events": events,
    }


def extract_ddr_entities(text: str, expected_well_id: Optional[str] = None) -> Dict[str, Any]:
    metadata = extract_ddr_metadata(text, expected_well_id=expected_well_id)
    events = extract_ddr_events(text)
    return {
        **metadata,
        "metadata": metadata,
        "events": events,
        "recent_parameters": _extract_recent_parameters(text),
        "recent_lessons": _extract_recent_lessons(text),
    }


def extract_entities(
    text: str,
    document_type: Optional[str] = None,
    expected_well_id: Optional[str] = None,
) -> Dict[str, Any]:
    text = normalize_whitespace(text)
    text = normalize_ocr_text(text)

    # Fix OCR-corrupted event names
    text = clean_ocr_event_boundaries(text)

    doc_type = detect_document_type(text, document_type=document_type)

    if doc_type == "DDR":
        entities = extract_ddr_entities(text, expected_well_id=expected_well_id)
    else:
        entities = extract_wcr_entities(text, expected_well_id=expected_well_id)

    entities["document_type"] = doc_type

    # DB document.well_id is authoritative when OCR corrupts the well ID.
    if expected_well_id:
        normalized_well_id = normalize_well_id(expected_well_id)
        entities["well_id"] = normalized_well_id
        entities["metadata"]["well_id"] = normalized_well_id

    # Final formation normalization.
    if entities.get("formation"):
        formation = normalize_formation(entities["formation"])
        entities["formation"] = formation
        entities["metadata"]["formation"] = formation

    return entities
