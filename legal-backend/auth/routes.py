"""
Authentication routes.

    POST /auth/login  — exchange email + password for a JWT
    GET  /auth/me     — return the current caseworker from the token
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from auth.auth import create_access_token, get_current_caseworker, verify_password
from database.connection import get_db
from database.crud import get_caseworker_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    caseworker_id: str
    role: str
    name: str


class MeResponse(BaseModel):
    caseworker_id: str
    role: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Exchange email + password for a JWT access token."""
    caseworker = get_caseworker_by_email(db, body.email)

    # Use a constant-time comparison path whether or not the user exists
    # to avoid user-enumeration via timing.
    dummy_hash = "$2b$12$placeholderplaceholderplaceholderplaceholderplaceholder"
    stored_hash = caseworker.hashed_password if caseworker else dummy_hash

    if not verify_password(body.password, stored_hash) or caseworker is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(str(caseworker.id), caseworker.role)
    return TokenResponse(
        access_token=token,
        caseworker_id=str(caseworker.id),
        role=caseworker.role,
        name=caseworker.name,
    )


@router.get("/me", response_model=MeResponse)
def me(
    current: Annotated[dict, Depends(get_current_caseworker)],
) -> MeResponse:
    """Return the identity encoded in the current Bearer token."""
    return MeResponse(
        caseworker_id=current["caseworker_id"],
        role=current["role"],
    )
