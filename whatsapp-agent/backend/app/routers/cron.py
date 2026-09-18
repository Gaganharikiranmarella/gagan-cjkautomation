"""Replaces the Celery Beat "Scheduler & Follow-ups" worker from the system
design with a Vercel Cron (or any external scheduler) hitting one protected
endpoint. See vercel.json's "crons" entry and the README for how often this
actually runs on your plan, and how to get more frequent ticks for free with
an external scheduler if you're on Vercel's Hobby tier.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings
from app.crypto import decrypt
from app.db import get_system_conn
from app.services import whatsapp_client

router = APIRouter(prefix="/cron", tags=["cron"])


def _require_cron_secret(authorization: str | None) -> None:
    settings = get_settings()
    expected = f"Bearer {settings.cron_secret}"
    if not settings.cron_secret or authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.api_route("/dispatch", methods=["GET", "POST"])
def dispatch(authorization: str | None = Header(default=None)):
    # GET: how Vercel's native Cron Jobs invoke this path (it auto-attaches
    # "Authorization: Bearer $CRON_SECRET" for you — see vercel.json).
    # POST: for an external scheduler (cron-job.org, GitHub Actions, etc.) if
    # you need more frequent ticks than your Vercel plan's cron allows.
    _require_cron_secret(authorization)
    results = {"follow_ups_armed": 0, "jobs_sent": 0, "jobs_failed": 0}

    with get_system_conn() as conn:
        with conn.cursor() as cur:
            # 1) Arm follow-up rules: any lead sitting in a rule's trigger_status
            #    for longer than delay_minutes, with no scheduled_jobs row yet.
            cur.execute(
                """SELECT r.id AS rule_id, r.tenant_id, r.delay_minutes, r.action, r.template_id,
                          l.id AS lead_id, l.contact_id
                   FROM follow_up_rules r
                   JOIN leads l ON l.tenant_id = r.tenant_id AND l.status = r.trigger_status
                   WHERE r.active = true
                     AND l.updated_at < now() - (r.delay_minutes || ' minutes')::interval
                     AND NOT EXISTS (
                       SELECT 1 FROM scheduled_jobs sj
                       WHERE sj.tenant_id = r.tenant_id
                         AND sj.job_type = 'follow_up_send'
                         AND sj.payload->>'rule_id' = r.id::text
                         AND sj.payload->>'lead_id' = l.id::text
                     )"""
            )
            due_rules = cur.fetchall()
            for row in due_rules:
                if row["action"] == "move_dormant":
                    cur.execute("UPDATE leads SET status = 'dormant', updated_at = now() WHERE id = %s", (row["lead_id"],))
                else:
                    cur.execute(
                        """INSERT INTO scheduled_jobs (tenant_id, job_type, payload, run_at, status)
                           VALUES (%s, 'follow_up_send', %s, now(), 'pending')""",
                        (
                            row["tenant_id"],
                            {
                                "rule_id": str(row["rule_id"]),
                                "lead_id": str(row["lead_id"]),
                                "contact_id": str(row["contact_id"]),
                                "template_id": str(row["template_id"]) if row["template_id"] else None,
                                "action": row["action"],
                            },
                        ),
                    )
                    results["follow_ups_armed"] += 1

            # 2) Send every due scheduled_jobs row (campaign sends + follow-up sends).
            cur.execute(
                "SELECT * FROM scheduled_jobs WHERE status = 'pending' AND run_at <= now() ORDER BY run_at LIMIT 200"
            )
            jobs = cur.fetchall()

        for job in jobs:
            with conn.cursor() as cur:
                cur.execute("UPDATE scheduled_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = %s", (job["id"],))

                cur.execute(
                    """SELECT ct.phone_e164, ct.opted_in, w.phone_number_id, w.access_token_enc, c.last_customer_message_at
                       FROM leads l
                       JOIN contacts ct ON ct.id = l.contact_id
                       LEFT JOIN conversations c ON c.lead_id = l.id
                       JOIN waba_accounts w ON w.tenant_id = l.tenant_id AND w.status = 'connected'
                       WHERE l.id = %s LIMIT 1""",
                    (job["payload"]["lead_id"],),
                )
                target = cur.fetchone()

                if not target or not target["opted_in"]:
                    cur.execute("UPDATE scheduled_jobs SET status = 'cancelled', last_error = 'opted out or missing contact' WHERE id = %s", (job["id"],))
                    continue

                template_id = job["payload"].get("template_id")
                if template_id:
                    cur.execute("SELECT name, locale FROM message_templates WHERE id = %s", (template_id,))
                    template = cur.fetchone()
                else:
                    template = None

                within_session = (
                    target["last_customer_message_at"]
                    and (dt.datetime.now(dt.timezone.utc) - target["last_customer_message_at"].replace(tzinfo=dt.timezone.utc)) < dt.timedelta(hours=24)
                )

                try:
                    access_token = decrypt(target["access_token_enc"])
                    to = target["phone_e164"].lstrip("+")
                    if template:
                        whatsapp_client.send_template_message(target["phone_number_id"], access_token, to, template["name"], template["locale"])
                    elif within_session:
                        whatsapp_client.send_text_message(target["phone_number_id"], access_token, to, "Just checking in — still interested?")
                    else:
                        raise RuntimeError("Outside the 24h session window and no approved template configured")

                    cur.execute("UPDATE scheduled_jobs SET status = 'sent' WHERE id = %s", (job["id"],))
                    results["jobs_sent"] += 1
                except Exception as exc:  # noqa: BLE001
                    cur.execute("UPDATE scheduled_jobs SET status = 'failed', last_error = %s WHERE id = %s", (str(exc), job["id"]))
                    results["jobs_failed"] += 1

    return results
