import os
import pandas as pd

from app.database.session import engine

DATA_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "data",
    "historical_events",
    "drilling_events.csv"
)

df = pd.read_csv(DATA_PATH)

df["event_date"] = pd.to_datetime(df["event_start"]).dt.date
cols = ["well_id", "event_date", "depth_m", "event_type", "severity", "formation", "mitigation_action"]
df = df[cols]

df.to_sql(
    "drilling_events",
    engine,
    if_exists="append",
    index=False
)

print(f"Imported {len(df)} drilling events.")