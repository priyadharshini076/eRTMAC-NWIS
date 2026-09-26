from __future__ import annotations

import json
import os
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv


load_dotenv()


def _get_config() -> dict[str, Any]:
    return {
        "enabled": os.getenv("RAG_LLM_ENABLED", "false").lower()
        == "true",
        "base_url": os.getenv(
            "RAG_LLM_BASE_URL",
            "https://api.openai.com/v1",
        ).rstrip("/"),
        "api_key": os.getenv("RAG_LLM_API_KEY", ""),
        "model": os.getenv("RAG_LLM_MODEL", ""),
        "timeout": int(
            os.getenv("RAG_LLM_TIMEOUT_SECONDS", "60")
        ),
    }


def _extract_json(text: str) -> dict:
    """
    Handles both pure JSON and ```json fenced responses.
    """

    cleaned = text.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        cleaned = "\n".join(lines).strip()

    return json.loads(cleaned)


def _fallback_response(
    query: dict,
    evidence: list[dict],
) -> dict:
    """
    Deterministic fallback when no LLM key is configured.
    Keeps the API usable during development.
    """

    findings = []

    for item in evidence[:5]:
        distance = abs(
            float(item["depth_m"])
            - float(query["current_depth_m"])
        )

        findings.append(
            {
                "finding": (
                    f'{item["severity"]} {item["event_type"]} '
                    f'was recorded at {item["depth_m"]} m '
                    f'in {item["well_name"]}, approximately '
                    f'{distance:.0f} m from the current depth.'
                ),
                "evidence_ids": [item["evidence_id"]],
            }
        )

    recommendations = []

    for item in evidence[:5]:
        for mitigation in item.get("mitigations", []):
            recommendations.append(
                {
                    "action": mitigation,
                    "reason": (
                        f'Retrieved from historical '
                        f'{item["event_type"]} evidence.'
                    ),
                    "evidence_ids": [item["evidence_id"]],
                }
            )

        for lesson in item.get("lessons", []):
            recommendations.append(
                {
                    "action": lesson,
                    "reason": (
                        f'Historical lesson associated with '
                        f'{item["event_type"]}.'
                    ),
                    "evidence_ids": [item["evidence_id"]],
                }
            )

    return {
        "generation_status": "fallback",
        "summary": (
            f'Historical evidence in the {query["formation"]} '
            f'formation shows relevant drilling events near '
            f'{query["current_depth_m"]} m.'
        ),
        "historical_findings": findings,
        "recommended_actions": recommendations[:6],
        "caution": (
            "No LLM was called. This response is generated "
            "deterministically from retrieved WCR/DDR evidence."
        ),
        "used_evidence_ids": [
            item["evidence_id"] for item in evidence
        ],
    }


def _validate_traceability(
    response: dict,
    evidence: list[dict],
) -> tuple[dict, list[str]]:
    """
    Prevent the model from returning references to non-existent
    evidence IDs.
    """

    valid_ids = {
        item["evidence_id"]
        for item in evidence
    }

    warnings = []

    clean_response = {
        "summary": response.get("summary", ""),
        "historical_findings": [],
        "recommended_actions": [],
        "caution": response.get("caution", ""),
        "used_evidence_ids": [],
    }

    for finding in response.get("historical_findings", []):
        if not isinstance(finding, dict):
            continue

        ids = [
            evidence_id
            for evidence_id in finding.get("evidence_ids", [])
            if evidence_id in valid_ids
        ]

        if not ids:
            warnings.append(
                "Removed a historical finding with invalid "
                "or missing evidence_ids."
            )
            continue

        clean_response["historical_findings"].append(
            {
                "finding": str(
                    finding.get("finding", "")
                ),
                "evidence_ids": ids,
            }
        )

    for action in response.get("recommended_actions", []):
        if not isinstance(action, dict):
            continue

        ids = [
            evidence_id
            for evidence_id in action.get("evidence_ids", [])
            if evidence_id in valid_ids
        ]

        if not ids:
            warnings.append(
                "Removed a recommendation with invalid "
                "or missing evidence_ids."
            )
            continue

        clean_response["recommended_actions"].append(
            {
                "action": str(
                    action.get("action", "")
                ),
                "reason": str(
                    action.get("reason", "")
                ),
                "evidence_ids": ids,
            }
        )

    used_ids = set()

    for item in clean_response["historical_findings"]:
        used_ids.update(item["evidence_ids"])

    for item in clean_response["recommended_actions"]:
        used_ids.update(item["evidence_ids"])

    clean_response["used_evidence_ids"] = sorted(
        used_ids
    )

    return clean_response, warnings


def generate_rag_response(
    query: dict,
    evidence: list[dict],
) -> dict:
    config = _get_config()

    if not config["enabled"]:
        return _fallback_response(
            query=query,
            evidence=evidence,
        )

    if not config["api_key"]:
        fallback = _fallback_response(
            query=query,
            evidence=evidence,
        )
        fallback["caution"] = (
            "RAG_LLM_ENABLED=true, but no "
            "RAG_LLM_API_KEY was configured. "
            "Returned deterministic evidence-grounded fallback."
        )
        return fallback

    if not config["model"]:
        fallback = _fallback_response(
            query=query,
            evidence=evidence,
        )
        fallback["caution"] = (
            "No RAG_LLM_MODEL was configured. "
            "Returned deterministic evidence-grounded fallback."
        )
        return fallback

    system_prompt = """
You are the grounded historical drilling intelligence assistant
for an Oil India offset-well decision support system.

Your job is to explain retrieved historical evidence for the
current well.

STRICT GROUNDING RULES:

1. Use ONLY the information supplied in the query and evidence.
2. Do not invent drilling facts, measurements, causes, outcomes,
   or operational conditions.
3. Do not use outside knowledge.
4. Every historical finding MUST cite one or more evidence_ids.
5. Every recommended action MUST cite one or more evidence_ids.
6. Recommendations may only rephrase or combine the supplied
   mitigation and lesson fields.
7. Do not create a recommendation when the supplied evidence
   does not contain supporting mitigation or lesson information.
8. Treat WCR and DDR records grouped under one evidence_id as
   sources describing the same historical incident.
9. Do not claim that historical occurrence guarantees recurrence.
10. Do not describe any score as a calibrated probability unless
    the query explicitly says it is calibrated.
11. Keep the answer concise and operationally traceable.
12. Prioritize evidence that matches the current risk
    signals and is closest to the current depth.
13. The primary historical signal and ML event-type candidates
    are contextual guidance for evidence prioritization, not
    proof that an event will occur.
14. Do not present a retrieved historical event as the current
    well's actual event unless the supplied telemetry explicitly
    supports that statement.
15. Clearly distinguish:
    - current telemetry/model signal
    - historical offset evidence
    - historical mitigation/lesson
16. When recommending actions, prefer evidence directly related
    to the current risk signal before discussing lower-relevance
    historical events.

Return ONLY valid JSON using exactly this structure:

{
  "summary": "string",
  "historical_findings": [
    {
      "finding": "string",
      "evidence_ids": ["EV-001"]
    }
  ],
  "recommended_actions": [
    {
      "action": "string",
      "reason": "string",
      "evidence_ids": ["EV-001"]
    }
  ],
  "caution": "string",
  "used_evidence_ids": ["EV-001"]
}
"""

    user_payload = {
        "query": query,
        "evidence": evidence,
    }

    request_body = {
        "model": config["model"],
        "temperature": 0.1,
        "messages": [
            {
                "role": "system",
                "content": system_prompt.strip(),
            },
            {
                "role": "user",
                "content": json.dumps(
                    user_payload,
                    ensure_ascii=False,
                    default=str,
                ),
            },
        ],
    }

    endpoint = (
    f'{config["base_url"].rstrip("/")}/chat/completions'
)

    request = Request(
        endpoint,
        data=json.dumps(
            request_body
        ).encode("utf-8"),
        headers={
            "Authorization": (
                f'Bearer {config["api_key"]}'
            ),
            "Content-Type": "application/json",
        },
        method="POST",
    )

    max_retries = 3
    retryable_statuses = {408, 429, 500, 502, 503, 504}

    last_error = None

    for attempt in range(max_retries + 1):
        try:
            with urlopen(
                request,
                timeout=config["timeout"],
            ) as response:
                response_data = json.loads(
                    response.read().decode("utf-8")
                )

            content = (
                response_data["choices"][0]["message"]["content"]
            )

            parsed = _extract_json(content)

            clean_response, warnings = (
                _validate_traceability(
                    parsed,
                    evidence,
                )
            )

            return {
                "generation_status": "llm",
                "model": config["model"],
                "response": clean_response,
                "validation_warnings": warnings,
                "attempts": attempt + 1,
            }

        except HTTPError as exc:
            last_error = exc

            try:
                error_body = (
                    exc.read()
                    .decode("utf-8", errors="replace")
                )
            except Exception:
                error_body = ""

            if (
                exc.code not in retryable_statuses
                or attempt >= max_retries
            ):
                fallback = _fallback_response(
                    query=query,
                    evidence=evidence,
                )

                fallback["caution"] = (
                    f"LLM request failed with HTTP "
                    f"{exc.code}. "
                    f"Provider response: {error_body[:500]}. "
                    "Returned deterministic "
                    "evidence-grounded fallback."
                )

                return fallback

            # Exponential backoff: 1s, 2s, 4s
            delay = 2 ** attempt
            time.sleep(delay)

        except (URLError, TimeoutError) as exc:
            last_error = exc

            if attempt >= max_retries:
                fallback = _fallback_response(
                    query=query,
                    evidence=evidence,
                )

                fallback["caution"] = (
                    f"LLM connection failed: {exc}. "
                    "Returned deterministic "
                    "evidence-grounded fallback."
                )

                return fallback

            delay = 2 ** attempt
            time.sleep(delay)

        except (
            KeyError,
            IndexError,
            json.JSONDecodeError,
        ) as exc:
            fallback = _fallback_response(
                query=query,
                evidence=evidence,
            )

            fallback["caution"] = (
                f"LLM returned an invalid response: {exc}. "
                "Returned deterministic "
                "evidence-grounded fallback."
            )

            return fallback

    fallback = _fallback_response(
        query=query,
        evidence=evidence,
    )

    fallback["caution"] = (
        f"LLM request failed after retries: {last_error}. "
        "Returned deterministic evidence-grounded fallback."
    )

    return fallback