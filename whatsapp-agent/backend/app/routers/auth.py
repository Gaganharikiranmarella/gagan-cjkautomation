from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.db import get_system_conn
from app.security import CurrentUser, create_access_token, get_current_user, hash_password, tenant_conn, verify_password

router = APIRouter(tags=["auth"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "tenant"


class SignupRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user: dict


@router.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    """Creates a brand-new tenant plus its first tenant_admin user. This is
    the self-serve "sign up your business" entry point — WhatsApp connection
    itself happens afterwards from Settings, per the Connect flow."""
    with get_system_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE email = %s", (body.email,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="An account with this email already exists")

            base_slug = _slugify(body.company_name)
            slug = base_slug
            suffix = 1
            while True:
                cur.execute("SELECT 1 FROM tenants WHERE slug = %s", (slug,))
                if not cur.fetchone():
                    break
                suffix += 1
                slug = f"{base_slug}-{suffix}"

            cur.execute(
                "INSERT INTO tenants (slug, name) VALUES (%s, %s) RETURNING id, slug, name, brand_config",
                (slug, body.company_name),
            )
            tenant = cur.fetchone()

            cur.execute(
                """INSERT INTO users (tenant_id, email, password_hash, name, role)
                   VALUES (%s, %s, %s, %s, 'tenant_admin')
                   RETURNING id, email, name, role, tenant_id""",
                (tenant["id"], body.email, hash_password(body.password), body.name),
            )
            user = cur.fetchone()

    token = create_access_token(str(user["id"]), str(user["tenant_id"]), user["role"])
    return AuthResponse(access_token=token, user={**user, "id": str(user["id"]), "tenant_id": str(user["tenant_id"]), "tenant": tenant})


@router.post("/auth/login", response_model=AuthResponse)
def login(body: LoginRequest):
    with get_system_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, tenant_id, email, password_hash, name, role, status FROM users WHERE email = %s",
                (body.email,),
            )
            user = cur.fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="This account has been disabled")

    token = create_access_token(str(user["id"]), str(user["tenant_id"]) if user["tenant_id"] else None, user["role"])
    return AuthResponse(
        access_token=token,
        user={
            "id": str(user["id"]),
            "tenant_id": str(user["tenant_id"]) if user["tenant_id"] else None,
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    )


@router.get("/users/me")
def me(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT id, email, name, role, tenant_id FROM users WHERE id = %s", (user.user_id,))
        row = cur.fetchone()
        cur.execute("SELECT id, name, slug, brand_config, active_locales FROM tenants WHERE id = %s", (user.tenant_id,))
        tenant = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {**row, "id": str(row["id"]), "tenant_id": str(row["tenant_id"]) if row["tenant_id"] else None, "tenant": tenant}


@router.get("/users")
def list_users(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, role, status, created_at FROM users WHERE tenant_id = %s ORDER BY created_at",
            (user.tenant_id,),
        )
        rows = cur.fetchall()
    return [{**r, "id": str(r["id"])} for r in rows]


class InviteRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = Field(pattern="^(tenant_admin|sales_rep|viewer)$")
    password: str = Field(min_length=8, max_length=128)


@router.post("/users", status_code=201)
def invite_user(body: InviteRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    if user.role not in ("tenant_admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only a tenant admin can add users")
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE email = %s", (body.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A user with this email already exists")
        cur.execute(
            """INSERT INTO users (tenant_id, email, password_hash, name, role)
               VALUES (%s, %s, %s, %s, %s) RETURNING id, email, name, role, status""",
            (user.tenant_id, body.email, hash_password(body.password), body.name, body.role),
        )
        row = cur.fetchone()
    return {**row, "id": str(row["id"])}
