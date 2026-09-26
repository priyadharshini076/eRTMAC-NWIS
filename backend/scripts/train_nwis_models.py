from __future__ import annotations

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    f1_score,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

EVENTS = [
    "Mud Loss",
    "Stuck Pipe",
    "Kick",
    "Cementing Issue",
    "Torque Spike",
    "Pressure Spike",
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

    df["torque_per_rpm"] = df["torque_kNm"] / df["rpm"].replace(0, np.nan)
    df["pressure_per_flow"] = df["pressure_psi"] / df["flow_rate_lpm"].replace(0, np.nan)
    df["time_delta_h"] = (
        df.groupby("well_id")["timestamp"]
        .diff()
        .dt.total_seconds()
        / 3600.0
    )

    # Future target: the NEXT telemetry row contains a real incident.
    # This supports early monitoring instead of reproducing the current label.
    df["next_event"] = df.groupby("well_id")["event_label"].shift(-1)
    df["target_binary"] = df["next_event"].isin(EVENTS).astype(int)
    df["target_type"] = df["next_event"].where(
        df["next_event"].isin(EVENTS), "No Event"
    )

    # Remove the last row of every well because it has no future target.
    df = df[df.groupby("well_id").cumcount(ascending=False).gt(0)].copy()

    # Early-warning rows should represent normal pre-event operating states.
    df = df[df["event_label"].fillna("").eq("")].copy()

    return df


def build_preprocessor(X: pd.DataFrame) -> tuple[ColumnTransformer, list[str]]:
    numeric = [c for c in X.columns if c not in CATEGORICAL]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                SimpleImputer(strategy="median"),
                numeric,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore"),
                        ),
                    ]
                ),
                CATEGORICAL,
            ),
        ]
    )

    return preprocessor, numeric


def split_groups(
    X: pd.DataFrame,
    y: np.ndarray,
    groups: pd.Series,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    outer = StratifiedGroupKFold(
        n_splits=5,
        shuffle=True,
        random_state=42,
    )
    train_val, test = next(outer.split(X, y, groups=groups))

    inner_X = X.iloc[train_val]
    inner_y = y[train_val]
    inner_groups = groups.iloc[train_val]

    inner = StratifiedGroupKFold(
        n_splits=4,
        shuffle=True,
        random_state=43,
    )
    train_rel, val_rel = next(
        inner.split(inner_X, inner_y, groups=inner_groups)
    )

    train = np.asarray(train_val)[train_rel]
    val = np.asarray(train_val)[val_rel]

    return train, val, np.asarray(test)


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    engineered = [
        c
        for c in df.columns
        if any(c.startswith(f"{base}_") for base in NUMERIC_BASE)
    ]

    features = [
        *NUMERIC_BASE,
        *CATEGORICAL,
        *engineered,
        "torque_per_rpm",
        "pressure_per_flow",
        "time_delta_h",
    ]

    X = df[features].loc[:, ~df[features].columns.duplicated()].copy()
    return X, features


def train_binary_detector(
    df: pd.DataFrame,
    X: pd.DataFrame,
    train: np.ndarray,
    val: np.ndarray,
    test: np.ndarray,
    out_dir: Path,
) -> dict:
    y = df["target_binary"].to_numpy()

    preprocessor, _ = build_preprocessor(X)
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
        n_estimators=700,
        max_depth=5,
        learning_rate=0.035,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        reg_lambda=3,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        random_state=42,
        n_jobs=4,
        scale_pos_weight=scale_pos_weight,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    def metrics(X_eval, y_eval):
        probability = model.predict_proba(X_eval)[:, 1]
        prediction = (probability >= 0.5).astype(int)
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
        }

    result = {
        "model_type": "XGBoost binary event detector",
        "target": "next telemetry row contains incident event",
        "train": metrics(X_train, y_train),
        "validation": metrics(X_val, y_val),
        "test": metrics(X_test, y_test),
        "train_rows": int(len(train)),
        "validation_rows": int(len(val)),
        "test_rows": int(len(test)),
        "train_positive_rows": positives,
        "feature_count_before_encoding": int(X.shape[1]),
    }

    bundle = {
        "preprocessor": preprocessor,
        "model": model,
        "features": list(X.columns),
        "event_classes": EVENTS,
        "target_definition": result["target"],
        "version": "v1",
    }

    joblib.dump(bundle, out_dir / "nwis_event_detector_xgb.joblib")
    return result


def train_multiclass_type_model(
    df: pd.DataFrame,
    X: pd.DataFrame,
    train: np.ndarray,
    val: np.ndarray,
    test: np.ndarray,
    out_dir: Path,
) -> dict:
    # Only rows where the next row is a known incident are used.
    positive_mask = df["target_binary"].eq(1)
    pos_indices = np.flatnonzero(positive_mask.to_numpy())

    # Keep the same group split by filtering each partition.
    train = np.intersect1d(train, pos_indices)
    val = np.intersect1d(val, pos_indices)
    test = np.intersect1d(test, pos_indices)

    enc = LabelEncoder()
    enc.fit(df.iloc[pos_indices]["target_type"])
    y_all = enc.transform(df.iloc[pos_indices]["target_type"])
    positive_row_to_encoded = dict(zip(pos_indices.tolist(), y_all.tolist()))

    preprocessor, _ = build_preprocessor(X)
    X_train = preprocessor.fit_transform(X.iloc[train])
    X_val = preprocessor.transform(X.iloc[val])
    X_test = preprocessor.transform(X.iloc[test])

    y_train = np.asarray([positive_row_to_encoded[i] for i in train])
    y_val = np.asarray([positive_row_to_encoded[i] for i in val])
    y_test = np.asarray([positive_row_to_encoded[i] for i in test])

    model = XGBClassifier(
        n_estimators=500,
        max_depth=4,
        learning_rate=0.04,
        subsample=0.90,
        colsample_bytree=0.90,
        min_child_weight=2,
        reg_lambda=2,
        objective="multi:softprob",
        num_class=len(enc.classes_),
        eval_metric="mlogloss",
        tree_method="hist",
        random_state=42,
        n_jobs=4,
    )

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    val_pred = model.predict(X_val)
    test_pred = model.predict(X_test)

    result = {
        "model_type": "XGBoost multiclass event-type classifier",
        "target": "next-row incident type",
        "classes": list(enc.classes_),
        "validation": {
            "accuracy": float(accuracy_score(y_val, val_pred)),
            "macro_f1": float(f1_score(y_val, val_pred, average="macro")),
            "weighted_f1": float(
                f1_score(y_val, val_pred, average="weighted")
            ),
        },
        "test": {
            "accuracy": float(accuracy_score(y_test, test_pred)),
            "macro_f1": float(f1_score(y_test, test_pred, average="macro")),
            "weighted_f1": float(
                f1_score(y_test, test_pred, average="weighted")
            ),
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
    }

    bundle = {
        "preprocessor": preprocessor,
        "model": model,
        "label_encoder": enc,
        "features": list(X.columns),
        "target_definition": result["target"],
        "version": "v1",
    }

    joblib.dump(bundle, out_dir / "nwis_event_type_xgb.joblib")
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
        .fillna("No Event")
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

    # Leakage audit: these columns must never appear in X.
    leaked = sorted(set(LEAKAGE_COLUMNS).intersection(X.columns))
    if leaked:
        raise RuntimeError(
            f"Leakage columns found in features: {leaked}"
        )

    print(f"Training rows: {len(train):,}")
    print(f"Validation rows: {len(val):,}")
    print(f"Test rows: {len(test):,}")
    print(f"Positive early-warning rows: {int(df['target_binary'].sum()):,}")

    detector_metrics = train_binary_detector(
        df,
        X,
        train,
        val,
        test,
        out_dir,
    )

    type_metrics = train_multiclass_type_model(
        df,
        X,
        train,
        val,
        test,
        out_dir,
    )

    report = {
        "input_rows": int(len(raw)),
        "input_wells": int(raw["well_id"].nunique()),
        "feature_names": feature_names,
        "leakage_columns_excluded": LEAKAGE_COLUMNS,
        "detector": detector_metrics,
        "event_type": type_metrics,
    }

    (out_dir / "ml_training_report.json").write_text(
        json.dumps(report, indent=2, default=str),
        encoding="utf-8",
    )

    print("\nTRAINING COMPLETE")
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
