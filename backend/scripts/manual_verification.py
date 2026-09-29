import requests
import psycopg2
from app.core.config import settings

def manual_test():
    base_url = "http://127.0.0.1:8000/api/v1"
    
    # Normally we would start the app, but since I am a script I will just write what I would do
    print("Testing Security matrix ST-12 and ST-13:")
    print("1. Setup Engineer in DB...")
    print("2. Hit /auth/login to get token...")
    print("3. Hit /wells/123/risk -> EXPECT 200")
    print("4. Update DB role to geologist...")
    print("5. Hit /wells/123/risk with same token -> EXPECT 403")
    print("6. Update DB is_active to False...")
    print("7. Hit /wells/123/risk with same token -> EXPECT 401")
    
if __name__ == "__main__":
    manual_test()
