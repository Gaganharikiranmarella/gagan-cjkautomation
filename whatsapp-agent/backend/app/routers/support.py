from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field

from app.db import get_system_conn
from app.services import email_service

router = APIRouter(prefix="/support", tags=["support"])


class ComplaintRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    category: str = Field(default="general", pattern="^(general|complaint|bug|billing)$")
    message: str = Field(min_length=5, max_length=5000)


@router.post("/complaint", status_code=201)
def submit_complaint(body: ComplaintRequest):
    """Public — reachable from the marketing site's /support page without
    being logged in, since a prospective customer or a complaint may come
    from someone who never signed up. Always routes to SUPPORT_EMAIL
    (ghk7125@gmail.com) regardless of tenant."""
    with get_system_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO support_messages (category, name, email, message)
                   VALUES (%s, %s, %s, %s) RETURNING id, created_at""",
                (body.category, body.name, body.email, body.message),
            )
            row = cur.fetchone()

    email_service.send_support_message_notification(body.category, body.name, body.email, body.message)
    email_service.send_support_receipt(body.email, body.name)

    return {"id": str(row["id"]), "status": "received", "created_at": row["created_at"]}
