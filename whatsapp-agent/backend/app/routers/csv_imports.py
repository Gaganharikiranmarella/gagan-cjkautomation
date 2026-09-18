from __future__ import annotations

import csv
import io
from typing import Optional

import phonenumbers
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.security import CurrentUser, get_current_user, tenant_conn
from app.services import claude_agent

router = APIRouter(prefix="/csv-imports", tags=["csv-imports"])

MAX_ROWS = 20_000


@router.post("/preview")
async def preview_csv(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    """Step 1 of the wizard: parse headers + first rows, and ask Claude to
    suggest a column mapping so the rep doesn't map every column by hand."""
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="The file is empty")
    headers = rows[0]
    sample = rows[1:6]
    suggested_mapping = claude_agent.suggest_csv_column_mapping(headers)
    return {"headers": headers, "sample_rows": sample, "total_rows": len(rows) - 1, "suggested_mapping": suggested_mapping}


class ConfirmImportRequest(BaseModel):
    mapping: dict[str, Optional[str]]  # target field -> source header
    default_region: str = "IN"
    dedupe_strategy: str = "skip"  # skip | merge


@router.post("")
async def create_import(
    file: UploadFile = File(...),
    payload: str = Form(...),  # JSON-encoded ConfirmImportRequest (multipart limitation)
    user: CurrentUser = Depends(get_current_user),
    conn=Depends(tenant_conn),
):
    import json

    body = ConfirmImportRequest(**json.loads(payload))
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if len(rows) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"CSV has more than {MAX_ROWS} rows; split it and re-upload")

    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO csv_imports (tenant_id, uploaded_by, filename, mapping, status, total_rows)
               VALUES (%s, %s, %s, %s, 'processing', %s) RETURNING id""",
            (user.tenant_id, user.user_id, file.filename, body.mapping, len(rows)),
        )
        import_id = cur.fetchone()["id"]

        success, errors = 0, 0
        phone_header = body.mapping.get("phone")
        name_header = body.mapping.get("name")
        company_header = body.mapping.get("company")
        notes_header = body.mapping.get("notes")

        for idx, row in enumerate(rows, start=1):
            raw_phone = row.get(phone_header, "") if phone_header else ""
            result, error_reason, lead_id = "failed", None, None
            try:
                if not raw_phone:
                    raise ValueError("Missing phone number")
                parsed = phonenumbers.parse(raw_phone, body.default_region)
                if not phonenumbers.is_valid_number(parsed):
                    raise ValueError("Invalid phone number")
                phone_e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

                cur.execute("SELECT id FROM contacts WHERE tenant_id = %s AND phone_e164 = %s", (user.tenant_id, phone_e164))
                existing = cur.fetchone()
                if existing and body.dedupe_strategy == "skip":
                    result, error_reason = "skipped_duplicate", "Contact already exists"
                else:
                    if existing:
                        contact_id = existing["id"]
                    else:
                        cur.execute(
                            "INSERT INTO contacts (tenant_id, phone_e164, name) VALUES (%s, %s, %s) RETURNING id",
                            (user.tenant_id, phone_e164, row.get(name_header) if name_header else None),
                        )
                        contact_id = cur.fetchone()["id"]

                    cur.execute(
                        """INSERT INTO leads (tenant_id, contact_id, company, source, notes, status)
                           VALUES (%s, %s, %s, 'csv_import', %s, 'new') RETURNING id""",
                        (
                            user.tenant_id,
                            contact_id,
                            row.get(company_header) if company_header else None,
                            row.get(notes_header) if notes_header else None,
                        ),
                    )
                    lead_id = cur.fetchone()["id"]
                    result, success = "imported", success + 1
            except Exception as exc:  # noqa: BLE001 — bad row data, not a system error
                error_reason = str(exc)
                errors += 1

            cur.execute(
                """INSERT INTO csv_import_rows (tenant_id, csv_import_id, row_number, raw_data, result, error_reason, lead_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (user.tenant_id, import_id, idx, row, result, error_reason, lead_id),
            )

        final_status = "completed" if errors == 0 else "completed_with_errors"
        cur.execute(
            "UPDATE csv_imports SET status = %s, success_count = %s, error_count = %s WHERE id = %s",
            (final_status, success, errors, import_id),
        )

    return {"id": str(import_id), "status": final_status, "success_count": success, "error_count": errors, "total_rows": len(rows)}


@router.get("/{import_id}")
def get_import(import_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM csv_imports WHERE id = %s AND tenant_id = %s", (import_id, user.tenant_id))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Import not found")
    return {**row, "id": str(row["id"])}


@router.get("/{import_id}/rows")
def get_import_rows(import_id: str, user: CurrentUser = Depends(get_current_user), conn=Depends(tenant_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT row_number, result, error_reason, raw_data FROM csv_import_rows WHERE csv_import_id = %s AND tenant_id = %s ORDER BY row_number",
            (import_id, user.tenant_id),
        )
        rows = cur.fetchall()
    return rows
