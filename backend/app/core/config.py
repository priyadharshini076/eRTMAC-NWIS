from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    SECRET_KEY = os.getenv("SECRET_KEY")
    PROJECT_NAME = os.getenv("PROJECT_NAME", "eRTMAC-NWIS")
    API_V1_PREFIX = os.getenv("API_V1_PREFIX", "/api/v1")

settings = Settings()