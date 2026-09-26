from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


EVENT_CLASSES = [
    "Mud Loss",
    "Stuck Pipe",
    "Kick",
    "Cementing Issue",
    "Torque Spike",
    "Pressure Spike",
]

BASE_NUMERIC = [
    "depth_m",
    "pressure_psi",
    "torque_kNm",
    "rpm",
    "mud_weight_ppg",
    "weight_on_bit_ton",
    "flow_rate_lpm",
]

CATEGORICAL = ["field", "district", "formation"]

PROJECT_MODEL_DIR = Path(__file__).resolve().parents[2] / "ml_artifacts"
PACKAGE_MODEL_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_DIR = PROJECT_MODEL_DIR if PROJECT_MODEL_DIR.exists() else PACKAGE_MODEL_DIR
DETECTOR_PATH = MODEL_DIR / "nwis_event_detector_xgb.joblib"
TYPE_PATH = MODEL_DIR / "nwis_event_type_xgb.joblib"


_detector_bundle: dict[str, Any] | None = None
_type_bundle: dict[str, Any] | None = None


def _load_models() -> tuple[dict[str, Any], dict[str, Any] | None]:
    global _detector_bundle, _type_bundle

    if _detector_bundle is None:
        if not DETECTOR_PATH.exists():
            raise FileNotFoundError(
                f"ML detector model not found: {DETECTOR_PATH}"
            )
        _detector_bundle = joblib.load(DETECTOR_PATH)

    if _type_bundle is None and TYPE_PATH.exists():
        _type_bundle = joblib.load(TYPE_PATH)

    return _detector_bundle, _type_bundle


def _engineer_features(logs: list[dict[str, Any]]) -> pd.DataFrame:
    if not logs:
        raise ValueError("At least one telemetry row is required.")

    df = pd.DataFrame(logs).copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    for column in BASE_NUMERIC:
        df[column] = pd.to_numeric(df[column], errors="coerce")
        previous = df[column].shift(1)

        df[f"{column}_delta"] = df[column].diff()
        df[f"{column}_pct_change"] = (
            (df[column] - previous) / previous.replace(0, np.nan)
        ).replace([np.inf, -np.inf], np.nan)

        df[f"{column}_roll_mean_3"] = df[column].rolling(
            3, min_periods=2
        ).mean()
        df[f"{column}_roll_std_3"] = df[column].rolling(
            3, min_periods=2
        ).std()
        df[f"{column}_roll_mean_5"] = df[column].rolling(
            5, min_periods=3
        ).mean()
        df[f"{column}_roll_std_5"] = df[column].rolling(
            5, min_periods=3
        ).std()

    df["torque_per_rpm"] = df["torque_kNm"] / df["rpm"].replace(0, np.nan)
    df["pressure_per_flow"] = (
        df["pressure_psi"] / df["flow_rate_lpm"].replace(0, np.nan)
    )
    df["time_delta_h"] = df["timestamp"].diff().dt.total_seconds() / 3600.0

    detector_bundle, _ = _load_models()
    feature_names = detector_bundle["features"]

    latest = df.iloc[[-1]].copy()
    
    for col in feature_names:
        if col not in latest.columns:
            latest[col] = None
            
    X = latest[feature_names].copy()

    return X


def predict_incident_risk(
    logs: list[dict[str, Any]],
) -> dict[str, Any]:
    detector_bundle, type_bundle = _load_models()

    X_latest = _engineer_features(logs)
    X_detector = detector_bundle["preprocessor"].transform(X_latest)

    probability = float(
        detector_bundle["model"].predict_proba(X_detector)[0, 1]
    )

    calibrated_threshold = float(
        detector_bundle.get("threshold", 0.71)
    )

    result: dict[str, Any] = {
        "model": "xgboost_event_detector_v1",
        "incident_probability": round(probability, 6),
        "ml_score_100": round(probability * 100.0, 2),
        "ml_alert": probability >= calibrated_threshold,
        "ml_alert_threshold": calibrated_threshold,
        "event_type_candidates": [],
    }

    # The event-type model is advisory only in V1 because its held-out
    # multiclass performance is materially weaker than the binary detector.
    if type_bundle is not None:
        X_type = type_bundle["preprocessor"].transform(X_latest)
        probabilities = type_bundle["model"].predict_proba(X_type)[0]
        encoder = type_bundle["label_encoder"]

        order = np.argsort(probabilities)[::-1][:3]

        result["event_type_candidates"] = [
            {
                "event_type": str(encoder.inverse_transform([index])[0]),
                "probability": round(float(probabilities[index]), 4),
            }
            for index in order
        ]

    return result
