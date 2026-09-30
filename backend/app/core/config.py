from dotenv import load_dotenv
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
load_dotenv(ROOT / ".env")

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    PROJECT_NAME = os.getenv("PROJECT_NAME", "eRTMAC-NWIS")
    API_V1_PREFIX = os.getenv("API_V1_PREFIX", "/api/v1")

settings = Settings()