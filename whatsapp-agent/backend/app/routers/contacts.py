from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.crypto import decrypt
from app.security import CurrentUser, get_current_user, tenant_conn
from app.services import claude_agent, whatsapp_client

router = APIRouter(tags=["contacts"])


@router.get("/contacts/{contact_id}")
def get_contact(contact_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM contacts WHERE id = %s AND tenant_id = %s", (contact_id, user.tenant_id))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {**row, "id": str(row["id"]), "tenant_id": str(row["tenant_id"])}


@router.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, contact_id, lead_id, state, current_flow_step, slots, locale FROM conversations WHERE id = %s AND tenant_id = %s",
            (conversation_id, user.tenant_id),
        )
        convo = cur.fetchone()
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")
        cur.execute(
            """SELECT id, direction, type, content, status, created_at FROM messages
               WHERE conversation_id = %s ORDER BY created_at ASC""",
            (conversation_id,),
        )
        messages = cur.fetchall()
    return {
        "conversation": {**convo, "id": str(convo["id"]), "contact_id": str(convo["contact_id"]), "lead_id": str(convo["lead_id"]) if convo["lead_id"] else None},
        "messages": [{**m, "id": str(m["id"])} for m in messages],
    }


class SendReplyRequest(BaseModel):
    text: str


@router.post("/conversations/{conversation_id}/messages", status_code=201)
def send_reply(conversation_id: str, body: SendReplyRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    """Lets a rep send a manual free-text reply from the transcript view."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT c.id, ct.phone_e164, w.phone_number_id, w.access_token_enc
               FROM conversations c
               JOIN contacts ct ON ct.id = c.contact_id
               JOIN waba_accounts w ON w.tenant_id = c.tenant_id AND w.status = 'connected'
               WHERE c.id = %s AND c.tenant_id = %s LIMIT 1""",
            (conversation_id, user.tenant_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Conversation or WhatsApp account not found")

        to = row["phone_e164"].lstrip("+")
        try:
            result = whatsapp_client.send_text_message(row["phone_number_id"], decrypt(row["access_token_enc"]), to, body.text)
            wa_id = result.get("messages", [{}])[0].get("id")
            msg_status = "sent"
        except Exception as exc:  # noqa: BLE001
            wa_id, msg_status = None, "failed"

        cur.execute(
            """INSERT INTO messages (tenant_id, conversation_id, direction, wa_message_id, type, content, status)
               VALUES (%s, %s, 'outbound', %s, 'text', %s, %s) RETURNING id, created_at""",
            (user.tenant_id, conversation_id, wa_id, {"text": body.text}, msg_status),
        )
        saved = cur.fetchone()
    if msg_status == "failed":
        raise HTTPException(status_code=502, detail="WhatsApp accepted the request but delivery failed — check the connected account")
    return {"id": str(saved["id"]), "status": msg_status, "created_at": saved["created_at"]}


class SuggestReplyRequest(BaseModel):
    instruction: str = "Draft a helpful, concise follow-up reply."


@router.post("/conversations/{conversation_id}/suggest-reply")
def suggest_reply(conversation_id: str, body: SuggestReplyRequest, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM conversations WHERE id = %s AND tenant_id = %s", (conversation_id, user.tenant_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Conversation not found")
        cur.execute(
            "SELECT direction, content FROM messages WHERE conversation_id = %s ORDER BY created_at DESC LIMIT 10",
            (conversation_id,),
        )
        history = [{"direction": r["direction"], "text": r["content"].get("text", "")} for r in reversed(cur.fetchall())]
    draft = claude_agent.suggest_reply_draft(history, body.instruction)
    return {"draft": draft}
