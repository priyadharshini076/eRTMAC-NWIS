import os
import pandas as pd

from app.database.session import engine

DATA_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "data",
    "daily_logs",
    "daily_drilling_logs.csv"
)

df = pd.read_csv(DATA_PATH)

cols = ["well_id", "timestamp", "depth_m", "pressure_psi", "torque_kNm", "rpm", "mud_weight_ppg", "weight_on_bit_ton", "flow_rate_lpm", "event_label", "alert_level"]
df = df[cols]
df["timestamp"] = pd.to_datetime(df["timestamp"])

df.to_sql(
    "daily_drilling_logs",
    engine,
    if_exists="append",
    index=False
)

print(f"Imported {len(df)} daily logs.")