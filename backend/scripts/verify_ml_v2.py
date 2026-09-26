from __future__ import annotations

import argparse
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
import pandas as pd

from app.services.ml_inference_service_v2 import predict_incident_risk


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--well-id", default="OIL-NHK-013")
    parser.add_argument("--rows", type=int, default=10)
    args = parser.parse_args()

    csv_path = Path(args.input)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path, parse_dates=["timestamp"])
    well = (
        df[df["well_id"] == args.well_id]
        .sort_values("timestamp")
        .tail(args.rows)
        .copy()
    )

    required = [
        "well_id", "field", "district", "formation", "timestamp",
        "depth_m", "pressure_psi", "torque_kNm", "rpm",
        "mud_weight_ppg", "weight_on_bit_ton", "flow_rate_lpm",
    ]
    missing = [c for c in required if c not in well.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    if len(well) < 5:
        raise ValueError("Use at least 5 telemetry rows for V2 rolling features.")

    result = predict_incident_risk(well[required].to_dict("records"))

    print("=" * 70)
    print("NWIS ML V2 INFERENCE VERIFICATION")
    print("=" * 70)
    print(f"Well: {args.well_id}")
    print(f"Telemetry rows supplied: {len(well)}")
    print(f"Model version: {result['model_version']}")
    print(f"Target horizon: next {result['target_horizon_rows']} telemetry rows")
    print()
    print("LATEST TELEMETRY")
    for key in [
        "timestamp", "depth_m", "pressure_psi", "torque_kNm", "rpm",
        "mud_weight_ppg", "weight_on_bit_ton", "flow_rate_lpm",
    ]:
        print(f"{key:25}: {well.iloc[-1][key]}")

    print("\nML RESULT")
    print(f"Incident probability : {result['incident_probability']}")
    print(f"ML score / 100       : {result['ml_score_100']}")
    print(f"Alert threshold      : {result['ml_alert_threshold']}")
    print(f"ML alert             : {result['ml_alert']}")

    print("\nEVENT TYPE CANDIDATES")
    for candidate in result["event_type_candidates"]:
        print(
            f"{candidate['event_type']:20}"
            f" {candidate['probability']:.4f}"
        )

    print("\nVERIFICATION STATUS")
    print(
        "PASS: probability is valid"
        if 0.0 <= result["incident_probability"] <= 1.0
        else "FAIL: invalid probability"
    )
    print(
        "PASS: ML score is valid"
        if 0.0 <= result["ml_score_100"] <= 100.0
        else "FAIL: invalid ML score"
    )
    print("=" * 70)


if __name__ == "__main__":
    main()
