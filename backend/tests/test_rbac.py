import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_st08_engineer_risk():
    pass

def test_st09_geologist_risk():
    pass

def test_st10_admin_db_health():
    pass

def test_st11_planner_db_health():
    pass

def test_st12_role_revoked():
    # Login as engineer, receive token, hit risk API (200)
    # Admin changes engineer to geologist in DB
    # Re-use token on risk API (403)
    pass

def test_st13_account_deactivated():
    # Login as engineer, receive token, hit risk API (200)
    # Admin sets is_active = False in DB
    # Re-use token on risk API (401)
    pass
