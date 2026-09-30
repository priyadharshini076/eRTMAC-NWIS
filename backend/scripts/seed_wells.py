import os
import pandas as pd
from sqlalchemy import text

from app.database.session import engine

DATA_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "data",
    "master_wells",
    "wells_master.csv"
)

df = pd.read_csv(DATA_PATH)

df['surface_casing'] = None
df = df.where(pd.notnull(df), None)

with engine.begin() as conn:

    conn.execute(text("DELETE FROM wells_master"))

    has_postgis = False
    try:
        has_postgis = bool(conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'postgis'")).scalar())
    except Exception:
        has_postgis = False

    geom_expr = "ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)" if has_postgis else "'POINT(' || :longitude || ' ' || :latitude || ')'"

    for _, row in df.iterrows():

        conn.execute(text(f"""
            INSERT INTO wells_master
            (
                well_id,
                well_name,
                api_number,
                field,
                district,
                formation,
                latitude,
                longitude,
                geom,
                target_depth_m,
                measured_depth_m,
                true_vertical_depth_m,
                rig_name,
                spud_date,
                completion_date,
                risk_zone,
                surface_casing
            )

            VALUES
            (
                :well_id,
                :well_name,
                :api_number,
                :field,
                :district,
                :formation,
                :latitude,
                :longitude,
                {geom_expr},
                :target_depth_m,
                :measured_depth_m,
                :true_vertical_depth_m,
                :rig_name,
                :spud_date,
                :completion_date,
                :risk_zone,
                :surface_casing
            )
        """), row.to_dict())

print(f"Imported {len(df)} wells.")