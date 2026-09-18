from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.security import CurrentUser, get_current_user, tenant_conn

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT n.id, n.lead_id, n.type, n.subject, n.status, n.read_at, n.created_at,
                      ct.name AS lead_name
               FROM notifications n
               LEFT JOIN leads l ON l.id = n.lead_id
               LEFT JOIN contacts ct ON ct.id = l.contact_id
               WHERE n.tenant_id = %s ORDER BY n.created_at DESC LIMIT 100""",
            (user.tenant_id,),
        )
        rows = cur.fetchall()
        cur.execute(
            "SELECT count(*) AS n FROM notifications WHERE tenant_id = %s AND read_at IS NULL",
            (user.tenant_id,),
        )
        unread = cur.fetchone()["n"]
    return {
        "items": [{**r, "id": str(r["id"]), "lead_id": str(r["lead_id"]) if r["lead_id"] else None} for r in rows],
        "unread_count": unread,
    }


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE notifications SET read_at = now() WHERE id = %s AND tenant_id = %s RETURNING id",
            (notification_id, user.tenant_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"id": str(row["id"]), "read": True}
