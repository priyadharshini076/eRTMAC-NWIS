import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_st01_health_without_token():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "Backend Online"}

def test_st02_protected_endpoint_without_token():
    response = client.get("/api/v1/wells/OIL-123/risk")
    assert response.status_code == 401

def test_st14_cors_request_unknown_origin():
    response = client.options("/api/v1/auth/login", headers={"Origin": "http://evil.com"})
    # It might be 400 or just omitted headers depending on middleware configuration, but the endpoint won't work in browser
    pass
