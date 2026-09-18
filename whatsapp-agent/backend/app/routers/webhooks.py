"""Inbound WhatsApp webhook: verification handshake + the message pipeline.

Meta requires the webhook to ack within 5 seconds; there's no Celery/Redis
queue in this deployment (see README "Architecture notes for Vercel"), so the
qualification pipeline — language detection, slot extraction, scoring,
persistence, reply — runs inline in the request. That's a fine trade for v1
message volumes and keeps the whole thing a single Vercel function with zero
extra infrastructure to stand up; swap in Upstash QStash later if volume
needs the decoupling back.
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from fastapi import APIRouter, Query, Request, Response

from app.config import get_settings
from app.crypto import decrypt
from app.db import get_system_conn
from app.services import claude_agent, email_service, scoring, whatsapp_client
from app.services.claude_agent import QUALIFICATION_SCRIPT

router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])


@router.get("")
def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    settings = get_settings()
    with get_system_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM waba_accounts WHERE verify_token = %s", (hub_verify_token,))
            known = cur.fetchone() is not None

    if hub_mode == "subscribe" and (known or hub_verify_token == settings.whatsapp_webhook_verify_token):
        return Response(content=hub_challenge, media_type="text/plain")
    return Response(status_code=403)


def _question_for_step(step: int, locale: str) -> Optional[dict[str, Any]]:
    for q in QUALIFICATION_SCRIPT:
        if q["step"] == step:
            return q
    return None


def _greeting(locale: str) -> str:
    return (
        "नमस्ते! हमसे संपर्क करने के लिए धन्यवाद। मैं कुछ त्वरित प्रश्न पूछूँगा ताकि हम आपकी बेहतर मदद कर सकें।"
        if locale == "hi"
        else "Hi there! Thanks for reaching out. I'll ask a couple of quick questions so we can help you best."
    )


@router.post("")
async def receive_webhook(request: Request):
    settings = get_settings()
    raw_body = await request.body()
    payload = await request.json()

    entries = payload.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            if not phone_number_id or not value.get("messages"):
                continue  # status callbacks (delivered/read) etc. — ignored in v1

            with get_system_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT id, tenant_id, access_token_enc, app_secret_enc, default_locale
                           FROM waba_accounts WHERE phone_number_id = %s AND status = 'connected'""",
                        (phone_number_id,),
                    )
                    waba = cur.fetchone()
                if not waba:
                    continue

                if waba["app_secret_enc"]:
                    signature = request.headers.get("x-hub-signature-256")
                    app_secret = decrypt(waba["app_secret_enc"])
                    if not whatsapp_client.verify_webhook_signature(app_secret, raw_body, signature):
                        continue  # drop silently; don't leak verification details to the caller

                    with conn.cursor() as cur:
                        cur.execute("SELECT set_config('app.tenant_id', %s, false)", (str(waba["tenant_id"]),))
                        cur.execute("SELECT set_config('app.role', 'super_admin', false)")

                access_token = decrypt(waba["access_token_enc"])
                tenant_id = waba["tenant_id"]

                with conn.cursor() as cur:
                    cur.execute("SELECT scoring_config FROM tenants WHERE id = %s", (tenant_id,))
                    tenant = cur.fetchone()
                scoring_config = tenant["scoring_config"] if tenant else {}

                wa_contacts = {c["wa_id"]: c.get("profile", {}).get("name") for c in value.get("contacts", [])}

                for msg in value.get("messages", []):
                    _process_inbound_message(conn, tenant_id, phone_number_id, access_token, scoring_config, msg, wa_contacts)

    return {"status": "ok"}


def _process_inbound_message(
    conn, tenant_id, phone_number_id: str, access_token: str, scoring_config: dict, msg: dict, wa_contacts: dict
) -> None:
    wa_id = msg.get("from")
    wa_message_id = msg.get("id")
    msg_type = msg.get("type", "text")
    text_body = msg.get("text", {}).get("body", "") if msg_type == "text" else f"[{msg_type} message]"
    phone_e164 = f"+{wa_id}" if not wa_id.startswith("+") else wa_id

    with conn.cursor() as cur:
        # Idempotency: Meta may redeliver the same webhook.
        cur.execute("SELECT 1 FROM messages WHERE wa_message_id = %s", (wa_message_id,))
        if cur.fetchone():
            return

        cur.execute(
            """INSERT INTO contacts (tenant_id, phone_e164, name)
               VALUES (%s, %s, %s)
               ON CONFLICT (tenant_id, phone_e164) DO UPDATE SET name = COALESCE(contacts.name, EXCLUDED.name)
               RETURNING id, locale""",
            (tenant_id, phone_e164, wa_contacts.get(wa_id)),
        )
        contact = cur.fetchone()

        cur.execute(
            """SELECT id, lead_id, state, current_flow_step, locale, slots, last_customer_message_at
               FROM conversations WHERE tenant_id = %s AND contact_id = %s
               ORDER BY created_at DESC LIMIT 1""",
            (tenant_id, contact["id"]),
        )
        convo = cur.fetchone()

        is_new_conversation = convo is None
        if is_new_conversation:
            cur.execute(
                """INSERT INTO conversations (tenant_id, contact_id, state, locale)
                   VALUES (%s, %s, 'new', %s) RETURNING id, lead_id, state, current_flow_step, locale, slots, last_customer_message_at""",
                (tenant_id, contact["id"], contact["locale"] or "en"),
            )
            convo = cur.fetchone()

        if convo["state"] == "opted_out":
            return

        first_reply_latency = None
        if convo["last_customer_message_at"] is None and not is_new_conversation:
            first_reply_latency = 0.0

        cur.execute(
            """INSERT INTO messages (tenant_id, conversation_id, direction, wa_message_id, type, content, status)
               VALUES (%s, %s, 'inbound', %s, %s, %s, 'received')""",
            (tenant_id, convo["id"], wa_message_id, msg_type, {"text": text_body}),
        )

        lead_id = convo["lead_id"]
        if lead_id is None:
            cur.execute(
                """INSERT INTO leads (tenant_id, contact_id, conversation_id, status, source)
                   VALUES (%s, %s, %s, 'new', 'whatsapp_inbound') RETURNING id""",
                (tenant_id, contact["id"], convo["id"]),
            )
            lead_id = cur.fetchone()["id"]
            cur.execute("UPDATE conversations SET lead_id = %s WHERE id = %s", (lead_id, convo["id"]))

        cur.execute(
            "SELECT direction, content FROM messages WHERE conversation_id = %s ORDER BY created_at DESC LIMIT 8",
            (convo["id"],),
        )
        history = [{"direction": r["direction"], "text": r["content"].get("text", "")} for r in reversed(cur.fetchall())]

    step = convo["current_flow_step"]
    current_question = _question_for_step(step + 1, convo["locale"])
    current_slot = current_question["slot"] if current_question else None

    analysis = claude_agent.analyze_message(text_body, current_slot, history)
    locale = "hi" if analysis.get("language") == "hi" else convo["locale"] or "en"

    slots = dict(convo["slots"] or {})
    if analysis.get("opted_out"):
        with conn.cursor() as cur:
            cur.execute("UPDATE conversations SET state = 'opted_out' WHERE id = %s", (convo["id"],))
            cur.execute("UPDATE contacts SET opted_in = false, opted_out_at = now() WHERE id = %s", (contact["id"],))
        return

    advanced = False
    if current_slot and analysis.get("extracted_value"):
        slots[current_slot] = analysis["extracted_value"]
        advanced = True

    questions_completed = sum(1 for q in QUALIFICATION_SCRIPT if q["slot"] in slots)

    score, breakdown = scoring.compute_score(
        scoring_config=scoring_config,
        slots=slots,
        source="whatsapp_inbound",
        questions_completed=questions_completed,
        last_customer_message_at=dt.datetime.now(dt.timezone.utc),
        first_reply_latency_seconds=first_reply_latency,
    )
    new_status = scoring.status_for_score(scoring_config, score)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT status, qualified_at, owner_user_id FROM leads WHERE id = %s",
            (lead_id,),
        )
        lead_row = cur.fetchone()
        was_qualified = lead_row["qualified_at"] is not None

        cur.execute(
            "INSERT INTO lead_score_history (tenant_id, lead_id, score, breakdown) VALUES (%s, %s, %s, %s)",
            (tenant_id, lead_id, score, breakdown),
        )

        qualified_at_sql = "now()" if (new_status == "qualified" and not was_qualified) else "leads.qualified_at"
        cur.execute(
            f"""UPDATE leads SET score = %s, status = %s, qualified_at = {qualified_at_sql}, updated_at = now()
                WHERE id = %s""",
            (score, new_status, lead_id),
        )

        next_step = step + 1 if advanced else step
        new_state = "qualified" if new_status == "qualified" else ("qualifying" if next_step > 0 else "greeting")
        cur.execute(
            """UPDATE conversations SET current_flow_step = %s, state = %s, slots = %s,
               locale = %s, last_customer_message_at = now(), updated_at = now() WHERE id = %s""",
            (next_step, new_state, slots, locale, convo["id"]),
        )

        if new_status == "qualified" and not was_qualified:
            cur.execute("SELECT name, email FROM users WHERE id = %s", (lead_row["owner_user_id"],)) if lead_row["owner_user_id"] else None
            owner = cur.fetchone() if lead_row["owner_user_id"] else None
            if not owner:
                cur.execute(
                    "SELECT email FROM users WHERE tenant_id = %s AND role = 'tenant_admin' ORDER BY created_at LIMIT 1",
                    (tenant_id,),
                )
                owner = cur.fetchone()
            if owner:
                dedupe_key = f"lead_qualified:{lead_id}"
                cur.execute(
                    """INSERT INTO notifications (tenant_id, lead_id, type, recipient, subject, dedupe_key, status)
                       VALUES (%s, %s, 'lead_qualified', %s, %s, %s, 'pending')
                       ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
                       RETURNING id""",
                    (tenant_id, lead_id, owner["email"], f"Qualified lead — score {score}", dedupe_key),
                )
                notif = cur.fetchone()
                if notif:
                    settings = get_settings()
                    email_service.send_qualified_lead_alert(
                        to=owner["email"],
                        lead_name=wa_contacts.get(wa_id) or phone_e164,
                        company=slots.get("company"),
                        score=score,
                        breakdown=breakdown,
                        dashboard_url=f"{settings.frontend_url}/dashboard/leads/{lead_id}",
                    )
                    cur.execute("UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = %s", (notif["id"],))

    reply_text = analysis.get("fallback_reply")
    if not reply_text:
        if step == 0:
            next_q = _question_for_step(1, locale)
            reply_text = f"{_greeting(locale)}\n\n{next_q['question_hi' if locale == 'hi' else 'question_en']}" if next_q else _greeting(locale)
        else:
            next_q = _question_for_step((step + 1 if advanced else step) + 1, locale)
            if next_q:
                reply_text = next_q["question_hi" if locale == "hi" else "question_en"]
            elif new_status == "qualified":
                reply_text = (
                    "धन्यवाद! हमारी टीम जल्द ही आपसे संपर्क करेगी।" if locale == "hi" else "Thank you! Our team will reach out to you shortly."
                )
            else:
                reply_text = "धन्यवाद!" if locale == "hi" else "Thanks for the details!"

    try:
        result = whatsapp_client.send_text_message(phone_number_id, access_token, wa_id, reply_text)
        wa_out_id = result.get("messages", [{}])[0].get("id")
    except Exception:  # noqa: BLE001 — never let a WhatsApp API hiccup break the pipeline
        wa_out_id = None

    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO messages (tenant_id, conversation_id, direction, wa_message_id, type, content, status)
               VALUES (%s, %s, 'outbound', %s, 'text', %s, %s)""",
            (tenant_id, convo["id"], wa_out_id, {"text": reply_text}, "sent" if wa_out_id else "failed"),
        )
