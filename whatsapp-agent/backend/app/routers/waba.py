from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.crypto import decrypt, encrypt
from app.security import CurrentUser, get_current_user, require_roles, tenant_conn
from app.services import whatsapp_client

router = APIRouter(prefix="/waba-accounts", tags=["waba"])


@router.get("")
def list_accounts(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, phone_number_id, waba_id, display_phone_number, display_name,
                      default_locale, connection_method, status, created_at
               FROM waba_accounts WHERE tenant_id = %s ORDER BY created_at DESC""",
            (user.tenant_id,),
        )
        rows = cur.fetchall()
    return [{**r, "id": str(r["id"])} for r in rows]


class ManualConnectRequest(BaseModel):
    phone_number_id: str = Field(min_length=3)
    waba_id: str = Field(min_length=3)
    access_token: str = Field(min_length=10)
    app_secret: str = Field(default="")
    default_locale: str = "en"


@router.post("/connect", status_code=201)
def connect_manual(body: ManualConnectRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    """The "Connect WhatsApp Business Account" button's default path: the
    tenant pastes the phone number ID + access token Meta hands them
    instantly (no app review needed) from WhatsApp > API Setup in their Meta
    App Dashboard. We validate the credentials against the Graph API before
    saving anything."""
    if user.role not in ("tenant_admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only a tenant admin can connect WhatsApp")

    try:
        details = whatsapp_client.fetch_phone_number_details(body.phone_number_id, body.access_token)
    except Exception as exc:  # noqa: BLE001 — surfaced to the UI as a validation error
        raise HTTPException(status_code=400, detail=f"Couldn't verify these credentials with Meta: {exc}")

    verify_token = secrets.token_urlsafe(24)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO waba_accounts
                 (tenant_id, phone_number_id, waba_id, display_phone_number, display_name,
                  access_token_enc, app_secret_enc, verify_token, default_locale, connection_method)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'manual')
               ON CONFLICT (phone_number_id) DO UPDATE SET
                 access_token_enc = EXCLUDED.access_token_enc,
                 app_secret_enc = EXCLUDED.app_secret_enc,
                 status = 'connected'
               RETURNING id, phone_number_id, waba_id, display_phone_number, verify_token""",
            (
                user.tenant_id,
                body.phone_number_id,
                body.waba_id,
                details.get("display_phone_number"),
                details.get("verified_name"),
                encrypt(body.access_token),
                encrypt(body.app_secret) if body.app_secret else None,
                verify_token,
                body.default_locale,
            ),
        )
        row = cur.fetchone()
    return {
        **row,
        "id": str(row["id"]),
        "webhook_url_hint": "/api/backend/webhooks/whatsapp",
        "verify_token": verify_token,
        "note": "Add this callback URL + verify token under Meta App > WhatsApp > Configuration.",
    }


class EmbeddedSignupExchangeRequest(BaseModel):
    code: str
    phone_number_id: str
    waba_id: str


@router.post("/embedded-signup/exchange", status_code=201)
def exchange_embedded_signup(
    body: EmbeddedSignupExchangeRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)
):
    """Completes Meta's one-click Embedded Signup flow: the frontend runs
    FB.login() with the WhatsApp embedded-signup config and hands us back a
    short-lived `code`, which we exchange server-side for a long-lived token.
    Requires NEXT_PUBLIC_META_APP_ID / META_APP_SECRET to be configured with
    an approved Meta app; otherwise the dashboard only shows the manual-connect
    option above."""
    if user.role not in ("tenant_admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only a tenant admin can connect WhatsApp")
    settings = get_settings()
    if not settings.meta_app_secret:
        raise HTTPException(status_code=400, detail="Embedded signup isn't configured on this deployment yet")

    # NEXT_PUBLIC_META_APP_ID is a frontend env var; the backend needs the same
    # app id to complete the token exchange, so we accept it from the trusted
    # server-side settings mirror instead of the client payload.
    import os

    app_id = os.environ.get("NEXT_PUBLIC_META_APP_ID", "")
    token_resp = whatsapp_client.exchange_embedded_signup_code(app_id, settings.meta_app_secret, body.code)
    access_token = token_resp.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Meta didn't return an access token for this code")

    details = whatsapp_client.fetch_phone_number_details(body.phone_number_id, access_token)
    verify_token = secrets.token_urlsafe(24)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO waba_accounts
                 (tenant_id, phone_number_id, waba_id, display_phone_number, display_name,
                  access_token_enc, app_secret_enc, verify_token, connection_method)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'embedded_signup')
               ON CONFLICT (phone_number_id) DO UPDATE SET
                 access_token_enc = EXCLUDED.access_token_enc, status = 'connected'
               RETURNING id, phone_number_id, waba_id, display_phone_number""",
            (
                user.tenant_id,
                body.phone_number_id,
                body.waba_id,
                details.get("display_phone_number"),
                details.get("verified_name"),
                encrypt(access_token),
                encrypt(settings.meta_app_secret),
                verify_token,
            ),
        )
        row = cur.fetchone()
    return {**row, "id": str(row["id"])}


@router.delete("/{account_id}", status_code=204)
def disconnect(account_id: str, user: CurrentUser = Depends(require_roles("tenant_admin")), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE waba_accounts SET status = 'disconnected' WHERE id = %s AND tenant_id = %s",
            (account_id, user.tenant_id),
        )
