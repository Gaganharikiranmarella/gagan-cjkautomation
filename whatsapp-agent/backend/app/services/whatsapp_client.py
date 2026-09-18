"""Thin wrapper around Meta's WhatsApp Cloud API (Graph API).

One function per outbound action; every call takes the tenant's own
phone_number_id + decrypted access token so a single process can serve every
tenant's own WhatsApp Business number.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any, Optional

import httpx

GRAPH_API_VERSION = "v21.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


def verify_webhook_signature(app_secret: str, payload_body: bytes, signature_header: Optional[str]) -> bool:
    """Verifies X-Hub-Signature-256 per Meta's webhook security requirement."""
    if not signature_header or not app_secret:
        return False
    expected = "sha256=" + hmac.new(app_secret.encode(), payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def send_text_message(phone_number_id: str, access_token: str, to: str, body: str) -> dict[str, Any]:
    url = f"{GRAPH_BASE}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    }
    resp = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def send_template_message(
    phone_number_id: str, access_token: str, to: str, template_name: str, locale: str, params: list[str] | None = None
) -> dict[str, Any]:
    url = f"{GRAPH_BASE}/{phone_number_id}/messages"
    components = []
    if params:
        components.append({"type": "body", "parameters": [{"type": "text", "text": p} for p in params]})
    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": locale},
            **({"components": components} if components else {}),
        },
    }
    resp = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_phone_number_details(phone_number_id: str, access_token: str) -> dict[str, Any]:
    """Used by the "Connect WhatsApp" flow to validate pasted credentials
    before saving them."""
    url = f"{GRAPH_BASE}/{phone_number_id}"
    resp = httpx.get(
        url,
        params={"fields": "verified_name,display_phone_number,quality_rating"},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def exchange_embedded_signup_code(app_id: str, app_secret: str, code: str) -> dict[str, Any]:
    """Exchanges the short-lived `code` returned by Meta's Embedded Signup JS
    SDK for a long-lived system-user access token."""
    url = f"{GRAPH_BASE}/oauth/access_token"
    resp = httpx.get(
        url,
        params={"client_id": app_id, "client_secret": app_secret, "code": code},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()
