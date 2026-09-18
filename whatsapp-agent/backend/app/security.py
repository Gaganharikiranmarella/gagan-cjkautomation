from __future__ import annotations

import datetime as dt
from typing import Iterator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.db import get_conn

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: str, tenant_id: Optional[str], role: str) -> str:
    settings = get_settings()
    expire = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=settings.jwt_expires_minutes)
    payload = {"sub": user_id, "tenant_id": tenant_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class CurrentUser:
    def __init__(self, user_id: str, tenant_id: Optional[str], role: str):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role = role


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return CurrentUser(user_id=payload["sub"], tenant_id=payload.get("tenant_id"), role=payload["role"])


def require_roles(*allowed_roles: str):
    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles and user.role != "super_admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed for your role")
        return user

    return dependency


def tenant_conn(user: CurrentUser = Depends(get_current_user)) -> Iterator:
    """FastAPI dependency yielding a DB connection scoped to the caller's
    tenant via RLS — the single place `set_tenant_context` happens."""
    with get_conn(tenant_id=user.tenant_id, role=user.role) as conn:
        yield conn
