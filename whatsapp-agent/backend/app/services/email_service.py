"""Transactional email via Resend — used for qualified-lead alerts and the
customer-care / complaint box (requirement: both routed to a support inbox).

Resend was picked over Amazon SES (the system design's §09 default
recommendation) purely for deploy-friction reasons: it needs one API key and
zero AWS account/IAM setup, which matters a lot for "must deploy to Vercel
with no difficulty". Swapping providers only touches this file.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

RESEND_URL = "https://api.resend.com/emails"


def _send(to: str, subject: str, html: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resend_api_key:
        # Don't crash the request pipeline if email isn't configured yet —
        # the notification/support row is still written by the caller.
        return {"skipped": True, "reason": "RESEND_API_KEY not set"}
    resp = httpx.post(
        RESEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def send_qualified_lead_alert(to: str, lead_name: str, company: str | None, score: float, breakdown: dict, dashboard_url: str) -> dict[str, Any]:
    rows = "".join(
        f"<tr><td style='padding:4px 12px'>{k.replace('_', ' ').title()}</td>"
        f"<td style='padding:4px 12px'>{v.get('points', v) if isinstance(v, dict) else v}</td></tr>"
        for k, v in breakdown.items()
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:480px">
      <h2 style="color:#12A9A6">New qualified lead — {lead_name}</h2>
      <p>{company or ''} just crossed your qualification threshold with a score of <b>{score}</b>.</p>
      <table style="border-collapse:collapse;width:100%">{rows}</table>
      <p style="margin-top:16px"><a href="{dashboard_url}" style="background:#12A9A6;color:#fff;
        padding:10px 16px;border-radius:6px;text-decoration:none">Open transcript</a></p>
    </div>
    """
    return _send(to, f"Qualified lead: {lead_name} (score {score})", html)


def send_support_message_notification(category: str, name: str, email: str, message: str) -> dict[str, Any]:
    settings = get_settings()
    html = f"""
    <div style="font-family:sans-serif;max-width:480px">
      <h2>New {category} — WhatsApp Lead Agent support</h2>
      <p><b>From:</b> {name} &lt;{email}&gt;</p>
      <p style="white-space:pre-wrap;border-left:3px solid #12A9A6;padding-left:12px">{message}</p>
    </div>
    """
    return _send(settings.support_email, f"[{category}] Support message from {name}", html)


def send_support_receipt(to_email: str, name: str) -> dict[str, Any]:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px">
      <p>Hi {name},</p>
      <p>Thanks for reaching out to WhatsApp Lead Agent support. We've received your message and
      will get back to you as soon as possible.</p>
    </div>
    """
    return _send(to_email, "We've received your message", html)
