from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    fbeta_score,
    f1_score,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from xgboost import XGBClassifier
import xgboost

# All incident labels present in the Layer-3 dataset are treated as incidents.
EVENTS = [
    "Mud Loss",
    "Torque Spike",
    "Stuck Pipe",
    "Kick",
    "Cementing Issue",
    "Pressure Spike",
    "NPT",
    "Fishing Operation",
]

NUMERIC_BASE = [
    "depth_m",
    "pressure_psi",
    "torque_kNm",
    "rpm",
    "mud_weight_ppg",
    "weight_on_bit_ton",
    "flow_rate_lpm",
]
CATEGORICAL = ["field", "district", "formation"]
LEAKAGE_COLUMNS = [
    "risk_zone",
    "event_label",
    "alert_level",
    "nearby_well_radius_km",
    "well_id",
]

HORIZON_ROWS = 3
RANDOM_STATE = 42


def slope(series: pd.Series) -> pd.Series:
    """One-step slope approximation: delta divided by timestamp gap later."""
    return series.diff()


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["well_id", "timestamp"]).copy()

    for col in NUMERIC_BASE:
        group = df.groupby("well_id")[col]
        prev = group.shift(1)

        df[f"{col}_delta"] = group.diff()
        df[f"{col}_pct_change"] = (
            (df[col] - prev) / prev.replace(0, np.nan)
        ).replace([np.inf, -np.inf], np.nan)

        df[f"{col}_roll_mean_3"] = group.transform(
            lambda s: s.rolling(3, min_periods=2).mean()
        )
        df[f"{col}_roll_std_3"] = group.transform(
            lambda s: s.rolling(3, min_periods=2).std()
        )
        df[f"{col}_roll_mean_5"] = group.transform(
            lambda s: s.rolling(5, min_periods=3).mean()
        )
        df[f"{col}_roll_std_5"] = group.transform(
            lambda s: s.rolling(5, min_periods=3).std()
        )

        # Short-window slope proxies.
        df[f"{col}_slope_3"] = group.transform(
            lambda s: s.diff(2) / 2.0
        )
        df[f"{col}_slope_5"] = group.transform(
            lambda s: s.diff(4) / 4.0
        )

        # Acceleration proxy.
        delta = group.diff()
        df[f"{col}_acceleration"] = delta.groupby(df["well_id"]).diff()

    df["torque_per_rpm"] = df["torque_kNm"] / df["rpm"].replace(0, np.nan)
    df["pressure_per_flow"] = (
        df["pressure_psi"] / df["flow_rate_lpm"].replace(0, np.nan)
    )
    df["flow_pressure_imbalance"] = (
        df["flow_rate_lpm"].groupby(df["well_id"]).diff()
        / df["pressure_psi"].groupby(df["well_id"]).diff().replace(0, np.nan)
    )
    df["torque_rpm_interaction"] = (
        df["torque_kNm"] * df["rpm"]
    )
    df["pressure_mud_weight_interaction"] = (
        df["pressure_psi"] * df["mud_weight_ppg"]
    )
    df["time_delta_h"] = (
        df.groupby("well_id")["timestamp"]
        .diff()
        .dt.total_seconds()
        / 3600.0
    )

    # Early-warning target: any incident in the next 3 telemetry rows.
    future_labels = [
        df.groupby("well_id")["event_label"].shift(-step)
        for step in range(1, HORIZON_ROWS + 1)
    ]

    future_incident_matrix = pd.concat(
        [s.isin(EVENTS).astype(int) for s in future_labels],
        axis=1,
    )

    # Keep track of whether the complete future horizon exists before removing
    # the current event rows. This prevents end-of-well rows from becoming
    # artificial negatives simply because their future labels are missing.
    horizon_complete = df.groupby("well_id").cumcount(ascending=False) >= HORIZON_ROWS

    df["target_binary"] = future_incident_matrix.max(axis=1).astype(int)

    # Earliest incident type in the horizon, if any.
    target_type = pd.Series("No Event", index=df.index, dtype="object")
    for step, future in reversed(list(enumerate(future_labels, start=1))):
        valid = future.isin(EVENTS)
        target_type.loc[valid] = future.loc[valid]

    df["target_type"] = target_type

    # Lead time in hours to the first future incident.
    incident_time = pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")
    for step in range(1, HORIZON_ROWS + 1):
        future_label = df.groupby("well_id")["event_label"].shift(-step)
        future_time = df.groupby("well_id")["timestamp"].shift(-step)
        valid = incident_time.isna() & future_label.isin(EVENTS)
        incident_time.loc[valid] = future_time.loc[valid]

    df["lead_time_to_event_h"] = (
        incident_time - df["timestamp"]
    ).dt.total_seconds() / 3600.0

    # Only pre-event rows are used as prediction points.
    df = df[df["event_label"].fillna("").eq("")].copy()

    # Last HORIZON_ROWS original rows per well have no complete future horizon.
    df = df[horizon_complete.loc[df.index]].copy()

    return df


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric = [c for c in X.columns if c not in CATEGORICAL]
    return ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), numeric),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                CATEGORICAL,
            ),
        ]
    )


def split_groups(
    X: pd.DataFrame,
    y: np.ndarray,
    groups: pd.Series,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    outer = StratifiedGroupKFold(
        n_splits=5,
        shuffle=True,
        random_state=RANDOM_STATE,
    )
    train_val, test = next(outer.split(X, y, groups=groups))

    inner = StratifiedGroupKFold(
        n_splits=4,
        shuffle=True,
        random_state=RANDOM_STATE + 1,
    )
    inner_X = X.iloc[train_val]
    inner_y = y[train_val]
    inner_groups = groups.iloc[train_val]
    train_rel, val_rel = next(
        inner.split(inner_X, inner_y, groups=inner_groups)
    )

    train = np.asarray(train_val)[train_rel]
    val = np.asarray(train_val)[val_rel]
    return train, val, np.asarray(test)


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    features = [*NUMERIC_BASE, *CATEGORICAL]

    for col in NUMERIC_BASE:
        features.extend(
            [
                f"{col}_delta",
                f"{col}_pct_change",
                f"{col}_roll_mean_3",
                f"{col}_roll_std_3",
                f"{col}_roll_mean_5",
                f"{col}_roll_std_5",
                f"{col}_slope_3",
                f"{col}_slope_5",
                f"{col}_acceleration",
            ]
        )

    features.extend(
        [
            "torque_per_rpm",
            "pressure_per_flow",
            "flow_pressure_imbalance",
            "torque_rpm_interaction",
            "pressure_mud_weight_interaction",
            "time_delta_h",
        ]
    )

    X = df[features].loc[:, ~df[features].columns.duplicated()].copy()
    return X, features


def classification_metrics(
    model: XGBClassifier,
    X_eval,
    y_eval: np.ndarray,
    threshold: float = 0.5,
) -> dict:
    probability = model.predict_proba(X_eval)[:, 1]
    prediction = (probability >= threshold).astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_eval,
        prediction,
        average="binary",
        zero_division=0,
    )

    return {
        "roc_auc": float(roc_auc_score(y_eval, probability)),
        "pr_auc": float(average_precision_score(y_eval, probability)),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "f2": float(fbeta_score(y_eval, prediction, beta=2, zero_division=0)),
        "threshold": float(threshold),
    }


def tune_threshold(
    model: XGBClassifier,
    X_val,
    y_val: np.ndarray,
) -> dict:
    probabilities = model.predict_proba(X_val)[:, 1]
    candidates = np.round(np.arange(0.10, 0.91, 0.01), 2)

    best = None
    rows = []

    for threshold in candidates:
        prediction = (probabilities >= threshold).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_val,
            prediction,
            average="binary",
            zero_division=0,
        )
        f2 = fbeta_score(
            y_val,
            prediction,
            beta=2,
            zero_division=0,
        )
        row = {
            "threshold": float(threshold),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "f2": float(f2),
        }
        rows.append(row)

        key = (f2, recall, precision)
        if best is None or key > best["_key"]:
            best = {**row, "_key": key}

    best.pop("_key", None)
    return {"selected": best, "grid": rows}


def train_binary_detector(
    df: pd.DataFrame,
    X: pd.DataFrame,
    train: np.ndarray,
    val: np.ndarray,
    test: np.ndarray,
    out_dir: Path,
) -> dict:
    y = df["target_binary"].to_numpy()

    preprocessor = build_preprocessor(X)
    X_train = preprocessor.fit_transform(X.iloc[train])
    X_val = preprocessor.transform(X.iloc[val])
    X_test = preprocessor.transform(X.iloc[test])

    y_train = y[train]
    y_val = y[val]
    y_test = y[test]

    positives = int(y_train.sum())
    negatives = int(len(y_train) - positives)
    scale_pos_weight = negatives / max(positives, 1)

    model = XGBClassifier(
        n_estimators=1600,
        max_depth=3,
        learning_rate=0.03,
        subsample=0.80,
        colsample_bytree=0.80,
        min_child_weight=6,
        gamma=0.10,
        reg_alpha=0.25,
        reg_lambda=6.0,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        random_state=RANDOM_STATE,
        n_jobs=4,
        scale_pos_weight=scale_pos_weight,
        early_stopping_rounds=80,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    threshold_info = tune_threshold(model, X_val, y_val)
    selected_threshold = threshold_info["selected"]["threshold"]

    train_metrics = classification_metrics(model, X_train, y_train, selected_threshold)
    val_metrics = classification_metrics(model, X_val, y_val, selected_threshold)
    test_metrics = classification_metrics(model, X_test, y_test, selected_threshold)

    result = {
        "model_type": "XGBoost binary early-warning detector V2",
        "target": "incident occurs in next 3 telemetry rows",
        "horizon_rows": HORIZON_ROWS,
        "selected_threshold": selected_threshold,
        "threshold_selection_metric": "F2 on validation set",
        "train": train_metrics,
        "validation": val_metrics,
        "test": test_metrics,
        "train_rows": int(len(train)),
        "validation_rows": int(len(val)),
        "test_rows": int(len(test)),
        "train_positive_rows": positives,
        "feature_count_before_encoding": int(X.shape[1]),
        "best_iteration": int(getattr(model, "best_iteration", -1)),
    }

    bundle = {
        "preprocessor": preprocessor,
        "model": model,
        "features": list(X.columns),
        "event_classes": EVENTS,
        "target_definition": result["target"],
        "horizon_rows": HORIZON_ROWS,
        "threshold": float(selected_threshold),
        "version": "v2",
    }

    joblib.dump(bundle, out_dir / "nwis_event_detector_xgb_v2.joblib")
    return result, threshold_info


def train_multiclass_type_model(
    df: pd.DataFrame,
    X: pd.DataFrame,
    train: np.ndarray,
    val: np.ndarray,
    test: np.ndarray,
    out_dir: Path,
) -> dict:
    positive_mask = df["target_binary"].eq(1)
    pos_indices = np.flatnonzero(positive_mask.to_numpy())

    train = np.intersect1d(train, pos_indices)
    val = np.intersect1d(val, pos_indices)
    test = np.intersect1d(test, pos_indices)

    enc = LabelEncoder()
    enc.fit(df.iloc[pos_indices]["target_type"])
    y_all = enc.transform(df.iloc[pos_indices]["target_type"])
    positive_row_to_encoded = dict(zip(pos_indices.tolist(), y_all.tolist()))

    preprocessor = build_preprocessor(X)
    X_train = preprocessor.fit_transform(X.iloc[train])
    X_val = preprocessor.transform(X.iloc[val])
    X_test = preprocessor.transform(X.iloc[test])

    y_train = np.asarray([positive_row_to_encoded[i] for i in train])
    y_val = np.asarray([positive_row_to_encoded[i] for i in val])
    y_test = np.asarray([positive_row_to_encoded[i] for i in test])

    # Inverse-frequency sample weights from the training partition only.
    class_counts = np.bincount(y_train, minlength=len(enc.classes_))
    class_weights = {
        cls: len(y_train) / (len(enc.classes_) * max(int(count), 1))
        for cls, count in enumerate(class_counts)
    }
    train_weights = np.asarray(
        [class_weights[int(label)] for label in y_train],
        dtype=float,
    )

    model = XGBClassifier(
        n_estimators=1200,
        max_depth=3,
        learning_rate=0.035,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=4,
        reg_alpha=0.15,
        reg_lambda=5.0,
        objective="multi:softprob",
        num_class=len(enc.classes_),
        eval_metric="mlogloss",
        tree_method="hist",
        random_state=RANDOM_STATE,
        n_jobs=4,
        early_stopping_rounds=60,
    )

    model.fit(
        X_train,
        y_train,
        sample_weight=train_weights,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    val_pred = model.predict(X_val)
    test_pred = model.predict(X_test)

    result = {
        "model_type": "XGBoost multiclass event-type classifier V2",
        "target": "earliest incident type within next 3 telemetry rows",
        "horizon_rows": HORIZON_ROWS,
        "classes": list(enc.classes_),
        "validation": {
            "accuracy": float(accuracy_score(y_val, val_pred)),
            "macro_f1": float(f1_score(y_val, val_pred, average="macro")),
            "weighted_f1": float(f1_score(y_val, val_pred, average="weighted")),
        },
        "test": {
            "accuracy": float(accuracy_score(y_test, test_pred)),
            "macro_f1": float(f1_score(y_test, test_pred, average="macro")),
            "weighted_f1": float(f1_score(y_test, test_pred, average="weighted")),
            "classification_report": classification_report(
                y_test,
                test_pred,
                target_names=enc.classes_,
                zero_division=0,
            ),
        },
        "rows": {
            "train": int(len(train)),
            "validation": int(len(val)),
            "test": int(len(test)),
        },
        "best_iteration": int(getattr(model, "best_iteration", -1)),
    }

    bundle = {
        "preprocessor": preprocessor,
        "model": model,
        "label_encoder": enc,
        "features": list(X.columns),
        "target_definition": result["target"],
        "horizon_rows": HORIZON_ROWS,
        "version": "v2",
    }

    joblib.dump(bundle, out_dir / "nwis_event_type_xgb_v2.joblib")
    return result


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="ml_artifacts")
    args = parser.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(args.input, parse_dates=["timestamp"])

    print(f"Loaded {len(raw):,} rows")
    print(f"Wells: {raw['well_id'].nunique():,}")
    print("Original event distribution:")
    print(
        raw["event_label"]
        .fillna("")
        .replace("", "No Event")
        .value_counts()
        .to_string()
    )

    df = add_features(raw)
    X, feature_names = prepare_features(df)

    train, val, test = split_groups(
        X,
        df["target_binary"].to_numpy(),
        df["well_id"],
    )

    leaked = sorted(set(LEAKAGE_COLUMNS).intersection(X.columns))
    if leaked:
        raise RuntimeError(
            f"Leakage columns found in features: {leaked}"
        )

    print(f"Training rows: {len(train):,}")
    print(f"Validation rows: {len(val):,}")
    print(f"Test rows: {len(test):,}")
    print(f"Positive early-warning rows: {int(df['target_binary'].sum()):,}")
    print(f"Horizon: next {HORIZON_ROWS} telemetry rows")

    detector_metrics, threshold_info = train_binary_detector(
        df, X, train, val, test, out_dir
    )

    type_metrics = train_multiclass_type_model(
        df, X, train, val, test, out_dir
    )

    positive_lead_times = df.loc[
        df["target_binary"].eq(1), "lead_time_to_event_h"
    ].dropna()

    report = {
        "version": "v2",
        "input_rows": int(len(raw)),
        "input_wells": int(raw["well_id"].nunique()),
        "feature_names": feature_names,
        "leakage_columns_excluded": LEAKAGE_COLUMNS,
        "events_in_binary_target": EVENTS,
        "horizon_rows": HORIZON_ROWS,
        "lead_time_hours": {
            "count": int(len(positive_lead_times)),
            "mean": float(positive_lead_times.mean()) if len(positive_lead_times) else None,
            "median": float(positive_lead_times.median()) if len(positive_lead_times) else None,
            "min": float(positive_lead_times.min()) if len(positive_lead_times) else None,
            "max": float(positive_lead_times.max()) if len(positive_lead_times) else None,
        },
        "detector": detector_metrics,
        "threshold_tuning": threshold_info,
        "event_type": type_metrics,
        "environment": {
            "python": sys.version,
            "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "joblib": joblib.__version__,
        },
    }

    (out_dir / "ml_training_report_v2.json").write_text(
        json.dumps(report, indent=2, default=str),
        encoding="utf-8",
    )

    print("\nTRAINING COMPLETE - V2")
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
