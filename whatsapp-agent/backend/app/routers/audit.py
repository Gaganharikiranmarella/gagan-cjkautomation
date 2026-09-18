from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.security import CurrentUser, get_current_user, tenant_conn

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("")
def list_audit_log(
    entity: Optional[str] = None,
    entity_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    conn=Depends(tenant_conn),
):
    clauses, params = ["a.tenant_id = %s"], [user.tenant_id]
    if entity:
        clauses.append("a.entity = %s")
        params.append(entity)
    if entity_id:
        clauses.append("a.entity_id = %s")
        params.append(entity_id)
    where = " AND ".join(clauses)
    offset = (page - 1) * page_size

    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) AS n FROM audit_log a WHERE {where}", params)
        total = cur.fetchone()["n"]
        cur.execute(
            f"""SELECT a.id, a.action, a.entity, a.entity_id, a.reason, a.metadata, a.created_at, u.name AS actor_name
                FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
                WHERE {where} ORDER BY a.created_at DESC LIMIT %s OFFSET %s""",
            [*params, page_size, offset],
        )
        rows = cur.fetchall()
    return {
        "items": [{**r, "id": str(r["id"]), "entity_id": str(r["entity_id"]) if r["entity_id"] else None} for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
