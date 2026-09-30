from datetime import datetime, timedelta
from typing import Any, Optional, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api import deps
from app.core import security
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import User as UserSchema

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class JsonLoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None

@router.get("/roles")
def get_supported_roles() -> List[Dict[str, Any]]:
    """
    Returns the 3 available roles with their descriptions and default platform credentials.
    """
    return [
        {
            "id": "drilling_engineer",
            "role": "drilling_engineer",
            "title": "Drilling Engineer",
            "subtitle": "Operate • Monitor • Analyze",
            "default_username": "drilling_engineer",
            "default_password": "password123",
            "full_name": "Er. Rakesh Sharma",
            "icon": "engineer"
        },
        {
            "id": "supervisor",
            "role": "drilling_supervisor",
            "title": "Supervisor",
            "subtitle": "Monitor • Approve • Take Action",
            "default_username": "drilling_supervisor",
            "default_password": "password123",
            "full_name": "Er. Rajiv Bordoloi",
            "icon": "supervisor"
        },
        {
            "id": "administrator",
            "role": "admin",
            "title": "Administrator",
            "subtitle": "Manage Users • System Oversight",
            "default_username": "admin",
            "default_password": "adminpassword123",
            "full_name": "System Administrator",
            "icon": "admin"
        }
    ]

@router.post("/login-json")
@limiter.limit("60/minute")
def login_with_json(
    request: Request,
    payload: JsonLoginRequest,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    JSON payload login for frontend UI, returning access token and user role profile.
    """
    username = payload.username.strip()
    password = payload.password.strip()

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    # Verify password (also allow password123 for admin for convenience)
    valid_pass = security.verify_password(password, user.password_hash)
    if not valid_pass and user.username == "admin" and password == "password123":
        valid_pass = True

    if not valid_pass:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated")

    access_token_expires = timedelta(minutes=120)
    user.last_login_at = datetime.utcnow()
    db.commit()

    token = security.create_access_token(str(user.id), expires_delta=access_token_expires)

    # Provide friendly role display name
    role_titles = {
        "drilling_engineer": "Drill Engineer",
        "drilling_supervisor": "Operations Supervisor",
        "admin": "System Administrator"
    }

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "role_title": role_titles.get(user.role, user.role.title()),
            "full_name": user.full_name or user.username.replace("_", " ").title(),
            "email": user.email
        }
    }

@router.post("/login", response_model=Token)
@limiter.limit("60/minute")
def login_access_token(
    request: Request,
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible form token login, get an access token for future requests
    """
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    valid_pass = security.verify_password(form_data.password, user.password_hash)
    if not valid_pass and user.username == "admin" and form_data.password == "password123":
        valid_pass = True

    if not valid_pass:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token_expires = timedelta(minutes=120)
    user.last_login_at = datetime.utcnow()
    db.commit()

    return {
        "access_token": security.create_access_token(
            str(user.id), expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.get("/me", response_model=UserSchema)
def read_current_user(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user
