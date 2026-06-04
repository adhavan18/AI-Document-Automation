"""
JWT authentication helpers and FastAPI dependency.

Environment variables required:
    JWT_SECRET   — signing secret (required)
    JWT_ALGORITHM — defaults to HS256
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

JWT_SECRET: str = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM: str = os.environ.get("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRY_HOURS: int = 8

_bearer = HTTPBearer(auto_error=True)
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_secret() -> str:
    if not JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET environment variable is not set. "
            "Set it before starting the server."
        )
    return JWT_SECRET


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*."""
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_ctx.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def create_access_token(caseworker_id: str, role: str) -> str:
    """Create a signed JWT valid for TOKEN_EXPIRY_HOURS hours."""
    secret = _require_secret()
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    payload = {
        "sub": str(caseworker_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate *token*.

    Returns a dict with keys ``caseworker_id`` and ``role``.
    Raises HTTPException 401 on any validation failure.
    """
    secret = _require_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    caseworker_id = payload.get("sub")
    role = payload.get("role")
    if not caseworker_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload incomplete",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"caseworker_id": caseworker_id, "role": role}


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_current_caseworker(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    FastAPI dependency.  Extracts the Bearer token from the Authorization
    header and returns ``{"caseworker_id": str, "role": str}``.

    Usage::

        @router.get("/protected")
        def protected(cw: Annotated[dict, Depends(get_current_caseworker)]):
            ...
    """
    return decode_token(credentials.credentials)


def require_admin(
    cw: Annotated[dict, Depends(get_current_caseworker)],
) -> dict:
    """Dependency that additionally enforces role == 'admin'."""
    if cw["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return cw
