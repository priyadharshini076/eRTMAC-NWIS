from __future__ import annotations
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv

load_dotenv()
import os
import sys
from typing import Any

import requests
import psycopg2


API_BASE = "http://127.0.0.1:8000"

# Use your existing PostgreSQL environment values.
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_NAME = os.getenv("DB_NAME", "ertmac_nwis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Priya@123")


def get_well_ids() -> list[str]:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT well_id
                FROM wells_master
                ORDER BY well_id
            """)
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def fetch_risk(well_id: str) -> dict[str, Any] | None:
    url = f"{API_BASE}/api/v1/wells/{well_id}/risk"

    params = {
        "radius": 5000,
        "depth_tolerance": 150,
        "minimum_supporting_wells": 2,
        "recent_window": 10,
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=30,
        )

        if response.status_code != 200:
            print(
                f"[ERROR] {well_id}: "
                f"HTTP {response.status_code} "
                f"{response.text[:200]}"
            )
            return None

        return response.json()

    except requests.RequestException as exc:
        print(f"[ERROR] {well_id}: {exc}")
        return None


def main() -> None:
    print("=" * 80)
    print("SEARCHING FOR: HISTORICAL MATCH + ML ALERT FALSE")
    print("=" * 80)

    # Verify API first.
    try:
        health = requests.get(
            f"{API_BASE}/api/v1/health",
            timeout=10,
        )
        print(f"API health: HTTP {health.status_code}")
    except requests.RequestException as exc:
        print(f"FastAPI is not reachable: {exc}")
        sys.exit(1)

    well_ids = get_well_ids()

    print(f"Wells to test: {len(well_ids)}")
    print()

    matches = []
    processed = 0

    for well_id in well_ids:
        result = fetch_risk(well_id)

        if not result:
            continue

        processed += 1

        ml = result.get("ml_prediction", {})
        fusion = result.get("fusion", {})
        historical = result.get("primary_historical_interval")

        ml_alert = ml.get("ml_alert")
        ml_score = ml.get("ml_score_100")
        final_score = fusion.get("final_score")
        risk_class = fusion.get("risk_class")

        # We specifically need:
        # 1. ML alert = False
        # 2. Historical primary interval exists
        if ml_alert is False and historical is not None:
            match = {
                "well_id": well_id,
                "depth_m": result.get("well", {}).get("current_depth_m"),
                "formation": result.get("well", {}).get("formation"),
                "ml_score_100": ml_score,
                "ml_alert_threshold": ml.get("ml_alert_threshold"),
                "final_score": final_score,
                "risk_class": risk_class,
                "historical_event_type": historical.get("event_type"),
                "historical_depth_min_m": historical.get("depth_min_m"),
                "historical_depth_max_m": historical.get("depth_max_m"),
                "historical_representative_depth_m": historical.get(
                    "representative_depth_m"
                ),
                "supporting_well_count": historical.get(
                    "supporting_well_count"
                ),
                "supporting_wells": historical.get(
                    "supporting_wells"
                ),
            }

            matches.append(match)

            print()
            print("FOUND MATCH")
            print("-" * 80)

            for key, value in match.items():
                print(f"{key:35}: {value}")

            # Stop at first usable case.
            break

        if processed % 10 == 0:
            print(f"Processed: {processed}/{len(well_ids)}")

    print()
    print("=" * 80)

    if not matches:
        print(
            "NO MATCH FOUND: no well currently satisfies "
            "ML alert = false AND primary historical interval exists."
        )

        print()
        print("We can broaden the test to:")
        print("  ML score < threshold + historical correlated interval")
        print("or")
        print("  ML alert false + correlated intervals > 0")
    else:
        print("TEST WELL SELECTED")
        print("=" * 80)
        print(matches[0])


if __name__ == "__main__":
    main()