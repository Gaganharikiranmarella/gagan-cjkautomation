from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.security import CurrentUser, get_current_user, tenant_conn

router = APIRouter(tags=["campaigns"])


@router.get("/templates")
def list_templates(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM message_templates WHERE tenant_id = %s ORDER BY created_at DESC", (user.tenant_id,))
        rows = cur.fetchall()
    return [{**r, "id": str(r["id"])} for r in rows]


class TemplateCreateRequest(BaseModel):
    name: str
    locale: str = "en"
    category: str = "marketing"
    body: str


@router.post("/templates", status_code=201)
def create_template(body: TemplateCreateRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO message_templates (tenant_id, name, locale, category, body)
               VALUES (%s,%s,%s,%s,%s) RETURNING *""",
            (user.tenant_id, body.name, body.locale, body.category, body.body),
        )
        row = cur.fetchone()
    return {**row, "id": str(row["id"])}


@router.get("/campaigns")
def list_campaigns(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT c.*, t.name AS template_name FROM campaigns c
               LEFT JOIN message_templates t ON t.id = c.template_id
               WHERE c.tenant_id = %s ORDER BY c.created_at DESC""",
            (user.tenant_id,),
        )
        rows = cur.fetchall()
    return [{**r, "id": str(r["id"]), "template_id": str(r["template_id"]) if r["template_id"] else None} for r in rows]


class CampaignCreateRequest(BaseModel):
    name: str
    template_id: str
    audience_filter: dict = {}
    schedule_type: str = "immediate"
    scheduled_at: Optional[str] = None


@router.post("/campaigns", status_code=201)
def create_campaign(body: CampaignCreateRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        status = "scheduled" if body.schedule_type == "scheduled" else "sending"
        cur.execute(
            """INSERT INTO campaigns (tenant_id, name, template_id, audience_filter, schedule_type, scheduled_at, status, created_by)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (user.tenant_id, body.name, body.template_id, body.audience_filter, body.schedule_type, body.scheduled_at, status, user.user_id),
        )
        campaign = cur.fetchone()

        # Resolve the audience (a simple status filter for v1) and enqueue one
        # scheduled_jobs row per recipient — the cron dispatcher (app/routers/cron.py)
        # is what actually sends them, respecting the 24h session-window rule.
        clauses, params = ["tenant_id = %s"], [user.tenant_id]
        if body.audience_filter.get("status"):
            clauses.append("status = %s")
            params.append(body.audience_filter["status"])
        cur.execute(f"SELECT id, contact_id FROM leads WHERE {' AND '.join(clauses)}", params)
        leads = cur.fetchall()

        run_at = body.scheduled_at or "now()"
        for lead in leads:
            cur.execute(
                """INSERT INTO scheduled_jobs (tenant_id, job_type, payload, run_at, status)
                   VALUES (%s, 'campaign_send', %s, COALESCE(%s, now()), 'pending')""",
                (user.tenant_id, {"campaign_id": str(campaign["id"]), "lead_id": str(lead["id"]), "contact_id": str(lead["contact_id"])}, body.scheduled_at),
            )

    return {**campaign, "id": str(campaign["id"]), "template_id": str(campaign["template_id"]), "recipients_enqueued": len(leads)}


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM campaigns WHERE id = %s AND tenant_id = %s", (campaign_id, user.tenant_id))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {**row, "id": str(row["id"])}


@router.get("/follow-up-rules")
def list_follow_up_rules(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM follow_up_rules WHERE tenant_id = %s ORDER BY created_at DESC", (user.tenant_id,))
        rows = cur.fetchall()
    return [{**r, "id": str(r["id"])} for r in rows]


class FollowUpRuleRequest(BaseModel):
    name: str
    trigger_status: str
    delay_minutes: int
    action: str = "send_template"
    template_id: Optional[str] = None
    active: bool = True


@router.post("/follow-up-rules", status_code=201)
def create_follow_up_rule(body: FollowUpRuleRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO follow_up_rules (tenant_id, name, trigger_status, delay_minutes, action, template_id, active)
               VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (user.tenant_id, body.name, body.trigger_status, body.delay_minutes, body.action, body.template_id, body.active),
        )
        row = cur.fetchone()
    return {**row, "id": str(row["id"])}


@router.put("/follow-up-rules/{rule_id}")
def update_follow_up_rule(rule_id: str, body: FollowUpRuleRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE follow_up_rules SET name=%s, trigger_status=%s, delay_minutes=%s, action=%s, template_id=%s, active=%s
               WHERE id = %s AND tenant_id = %s RETURNING *""",
            (body.name, body.trigger_status, body.delay_minutes, body.action, body.template_id, body.active, rule_id, user.tenant_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {**row, "id": str(row["id"])}
