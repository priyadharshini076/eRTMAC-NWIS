import os
from pathlib import Path
import pandas as pd

from app.database.session import engine

ROOT = Path(__file__).resolve().parents[2]

records = []

for folder in ["wcr","ddr"]:

    path = ROOT/"data"/"documents"/folder

    for file in path.glob("*.pdf"):

        records.append({
            "well_id": file.stem.split("_")[0],
            "document_type": folder.upper(),
            "file_name": file.name,
            "file_path": str(file),
            "status": "available"
        })

df = pd.DataFrame(records)

df.to_sql(
    "documents",
    engine,
    if_exists="append",
    index=False
)

print(f"Imported {len(df)} document records.")