import subprocess
import sys
import os
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.database.session import engine

# Clear database in one transaction
with engine.begin() as conn:
    conn.execute(text("""
        TRUNCATE TABLE
            daily_drilling_logs,
            drilling_events,
            documents,
            wells_master
        RESTART IDENTITY CASCADE;
    """))

print("Database cleared.")

scripts = [
    "seed_wells.py",
    "seed_events.py",
    "seed_logs.py",
    "seed_documents.py",
]

for script in scripts:
    print(f"Running {script}")
    env = os.environ.copy()
    env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])
    subprocess.run(
        [sys.executable, f"scripts/{script}"],
        env=env,
        check=True
    )

print("Database seeded successfully.")