from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.security import CurrentUser, get_current_user, tenant_conn

router = APIRouter(tags=["leads"])


def _build_filters(status: Optional[str], source: Optional[str], owner: Optional[str], q: Optional[str], min_score: Optional[float], max_score: Optional[float]):
    clauses, params = [], []
    if status:
        clauses.append("l.status = %s")
        params.append(status)
    if source:
        clauses.append("l.source = %s")
        params.append(source)
    if owner:
        clauses.append("l.owner_user_id = %s")
        params.append(owner)
    if min_score is not None:
        clauses.append("l.score >= %s")
        params.append(min_score)
    if max_score is not None:
        clauses.append("l.score <= %s")
        params.append(max_score)
    if q:
        clauses.append("(ct.name ILIKE %s OR ct.phone_e164 ILIKE %s OR l.company ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    return clauses, params


@router.get("/leads")
def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    owner: Optional[str] = None,
    q: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    conn=Depends(tenant_conn),
):
    clauses, params = _build_filters(status, source, owner, q, min_score, max_score)
    where = " AND ".join(["l.tenant_id = %s"] + clauses)
    offset = (page - 1) * page_size

    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) AS n FROM leads l JOIN contacts ct ON ct.id = l.contact_id WHERE {where}", [user.tenant_id, *params])
        total = cur.fetchone()["n"]

        cur.execute(
            f"""SELECT l.id, l.status, l.score, l.source, l.company, l.qualified_at, l.created_at,
                       ct.name AS contact_name, ct.phone_e164, u.name AS owner_name
                FROM leads l
                JOIN contacts ct ON ct.id = l.contact_id
                LEFT JOIN users u ON u.id = l.owner_user_id
                WHERE {where}
                ORDER BY l.updated_at DESC
                LIMIT %s OFFSET %s""",
            [user.tenant_id, *params, page_size, offset],
        )
        rows = cur.fetchall()
    return {
        "items": [{**r, "id": str(r["id"])} for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/leads/export")
def export_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    owner: Optional[str] = None,
    q: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
    conn=Depends(tenant_conn),
):
    clauses, params = _build_filters(status, source, owner, q, None, None)
    where = " AND ".join(["l.tenant_id = %s"] + clauses)
    with conn.cursor() as cur:
        cur.execute(
            f"""SELECT ct.name AS contact_name, ct.phone_e164, l.company, l.status, l.score, l.source,
                       u.name AS owner_name, l.created_at
                FROM leads l
                JOIN contacts ct ON ct.id = l.contact_id
                LEFT JOIN users u ON u.id = l.owner_user_id
                WHERE {where} ORDER BY l.created_at DESC""",
            [user.tenant_id, *params],
        )
        rows = cur.fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Name", "Phone", "Company", "Status", "Score", "Source", "Owner", "Created At"])
    for r in rows:
        writer.writerow([r["contact_name"], r["phone_e164"], r["company"], r["status"], r["score"], r["source"], r["owner_name"], r["created_at"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT l.*, ct.name AS contact_name, ct.phone_e164, ct.locale, u.name AS owner_name
               FROM leads l JOIN contacts ct ON ct.id = l.contact_id LEFT JOIN users u ON u.id = l.owner_user_id
               WHERE l.id = %s AND l.tenant_id = %s""",
            (lead_id, user.tenant_id),
        )
        lead = cur.fetchone()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        cur.execute(
            "SELECT score, breakdown, created_at FROM lead_score_history WHERE lead_id = %s ORDER BY created_at DESC",
            (lead_id,),
        )
        history = cur.fetchall()
        cur.execute(
            """SELECT t.name FROM tags t JOIN lead_tags lt ON lt.tag_id = t.id WHERE lt.lead_id = %s""",
            (lead_id,),
        )
        tags = [r["name"] for r in cur.fetchall()]
    return {
        **lead,
        "id": str(lead["id"]),
        "tenant_id": str(lead["tenant_id"]),
        "contact_id": str(lead["contact_id"]),
        "conversation_id": str(lead["conversation_id"]) if lead["conversation_id"] else None,
        "owner_user_id": str(lead["owner_user_id"]) if lead["owner_user_id"] else None,
        "score_history": history,
        "tags": tags,
    }


class LeadUpdateRequest(BaseModel):
    status: Optional[str] = None
    owner_user_id: Optional[str] = None
    score: Optional[float] = None
    reason: str = Field(min_length=3, description="Required — every manual override is written to the audit log")


@router.patch("/leads/{lead_id}")
def update_lead(lead_id: str, body: LeadUpdateRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    fields, params = [], []
    for col in ("status", "owner_user_id", "score"):
        val = getattr(body, col)
        if val is not None:
            fields.append(f"{col} = %s")
            params.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM leads WHERE id = %s AND tenant_id = %s", (lead_id, user.tenant_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Lead not found")

        cur.execute(
            f"UPDATE leads SET {', '.join(fields)}, updated_at = now() WHERE id = %s RETURNING *",
            [*params, lead_id],
        )
        updated = cur.fetchone()

        cur.execute(
            """INSERT INTO audit_log (tenant_id, actor_user_id, action, entity, entity_id, reason, metadata)
               VALUES (%s, %s, 'lead.override', 'lead', %s, %s, %s)""",
            (user.tenant_id, user.user_id, lead_id, body.reason, body.model_dump(exclude={"reason"}, exclude_none=True)),
        )
    return {**updated, "id": str(updated["id"])}


class TagRequest(BaseModel):
    name: str


@router.post("/leads/{lead_id}/tags", status_code=201)
def add_tag(lead_id: str, body: TagRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM leads WHERE id = %s AND tenant_id = %s", (lead_id, user.tenant_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Lead not found")
        cur.execute(
            "INSERT INTO tags (tenant_id, name) VALUES (%s, %s) ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
            (user.tenant_id, body.name),
        )
        tag_id = cur.fetchone()["id"]
        cur.execute("INSERT INTO lead_tags (lead_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (lead_id, tag_id))
    return {"lead_id": lead_id, "tag": body.name}


class BulkActionRequest(BaseModel):
    lead_ids: list[str]
    action: str = Field(pattern="^(assign_owner|add_tag|export)$")
    owner_user_id: Optional[str] = None
    tag_name: Optional[str] = None


@router.post("/leads/bulk")
def bulk_action(body: BulkActionRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        if body.action == "assign_owner" and body.owner_user_id:
            cur.execute(
                "UPDATE leads SET owner_user_id = %s, updated_at = now() WHERE id = ANY(%s) AND tenant_id = %s",
                (body.owner_user_id, body.lead_ids, user.tenant_id),
            )
        elif body.action == "add_tag" and body.tag_name:
            cur.execute(
                "INSERT INTO tags (tenant_id, name) VALUES (%s, %s) ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
                (user.tenant_id, body.tag_name),
            )
            tag_id = cur.fetchone()["id"]
            for lead_id in body.lead_ids:
                cur.execute("INSERT INTO lead_tags (lead_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (lead_id, tag_id))
        else:
            raise HTTPException(status_code=400, detail="Invalid bulk action payload")
    return {"updated": len(body.lead_ids)}
