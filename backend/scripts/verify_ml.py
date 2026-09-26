from __future__ import annotations

import argparse
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
import pandas as pd

from app.services.ml_inference_service import predict_incident_risk


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument(
        "--well-id",
        default="OIL-NHK-013",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=10,
    )
    args = parser.parse_args()

    csv_path = Path(args.input)

    if not csv_path.exists():
        raise FileNotFoundError(
            f"CSV not found: {csv_path}"
        )

    df = pd.read_csv(
        csv_path,
        parse_dates=["timestamp"],
    )

    required_columns = [
        "well_id",
        "field",
        "district",
        "formation",
        "timestamp",
        "depth_m",
        "pressure_psi",
        "torque_kNm",
        "rpm",
        "mud_weight_ppg",
        "weight_on_bit_ton",
        "flow_rate_lpm",
    ]

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing columns: {missing}"
        )

    well = (
        df[df["well_id"] == args.well_id]
        .sort_values("timestamp")
        .tail(args.rows)
        .copy()
    )

    if len(well) < 3:
        raise ValueError(
            f"Not enough telemetry rows for {args.well_id}"
        )

    logs = well[
        required_columns
    ].to_dict("records")

    result = predict_incident_risk(logs)

    print("=" * 70)
    print("NWIS ML INFERENCE VERIFICATION")
    print("=" * 70)

    print(f"Well: {args.well_id}")
    print(f"Telemetry rows supplied: {len(logs)}")

    print("\nLATEST TELEMETRY")
    latest = logs[-1]

    for key in [
        "timestamp",
        "depth_m",
        "pressure_psi",
        "torque_kNm",
        "rpm",
        "mud_weight_ppg",
        "weight_on_bit_ton",
        "flow_rate_lpm",
    ]:
        print(
            f"{key:25}: {latest.get(key)}"
        )

    print("\nML RESULT")
    print(
        f"Incident probability : "
        f"{result['incident_probability']}"
    )

    print(
        f"ML score / 100       : "
        f"{result['ml_score_100']}"
    )

    print(
        f"Alert threshold      : "
        f"{result['ml_alert_threshold']}"
    )

    print(
        f"ML alert             : "
        f"{result['ml_alert']}"
    )

    print("\nEVENT TYPE CANDIDATES")

    for candidate in result[
        "event_type_candidates"
    ]:
        print(
            f"{candidate['event_type']:20}"
            f" {candidate['probability']:.4f}"
        )

    print("\nVERIFICATION STATUS")

    if (
        0.0
        <= result["incident_probability"]
        <= 1.0
    ):
        print("PASS: probability is valid")

    else:
        print(
            "FAIL: invalid probability"
        )

    if (
        0.0
        <= result["ml_score_100"]
        <= 100.0
    ):
        print("PASS: ML score is valid")

    else:
        print(
            "FAIL: invalid ML score"
        )

    print("=" * 70)


if __name__ == "__main__":
    main()