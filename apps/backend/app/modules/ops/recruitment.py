"""
Coffee chat recruitment: Google Sheets import, pairing UI, Gmail send.
"""
import base64
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Membership
from app.models.recruitment import CoffeeChatApplicant, GmailToken, RecruitmentCycle
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role

router = APIRouter(prefix="/recruitment", tags=["recruitment"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GMAIL_SCOPES = "https://mail.google.com/ https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _grad_date_to_year(grad_date: str) -> str:
    mapping = {
        "Spring 2029": "freshman", "Fall 2028": "freshman",
        "Spring 2028": "sophomore", "Fall 2027": "sophomore",
        "Spring 2027": "junior", "Fall 2026": "junior",
        "Spring 2026": "senior", "Fall 2025": "senior",
    }
    return mapping.get(str(grad_date).strip(), grad_date or "")


async def _get_valid_token(db: AsyncSession) -> GmailToken:
    result = await db.execute(select(GmailToken).limit(1))
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=503, detail="Gmail not connected. Connect Gmail in Recruitment settings.")

    # Refresh if expired
    if token.token_expiry and datetime.now(timezone.utc) >= token.token_expiry:
        async with httpx.AsyncClient() as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data={
                "client_id": settings.GMAIL_CLIENT_ID,
                "client_secret": settings.GMAIL_CLIENT_SECRET,
                "refresh_token": token.refresh_token,
                "grant_type": "refresh_token",
            })
        if resp.status_code != 200:
            raise HTTPException(status_code=503, detail="Failed to refresh Gmail token. Please reconnect.")
        data = resp.json()
        token.access_token = data["access_token"]
        if "expires_in" in data:
            from datetime import timedelta
            token.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"] - 60)
        await db.commit()

    return token


def _build_email(to: str, cc: str | None, subject: str, body_html: str) -> str:
    msg = MIMEMultipart()
    msg["to"] = to
    if cc:
        msg["cc"] = cc
    msg["subject"] = subject
    msg.attach(MIMEText(body_html, "html"))
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


async def _send_gmail(token: GmailToken, to: str, cc: str | None, subject: str, body_html: str) -> str:
    raw = _build_email(to, cc, subject, body_html)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {token.access_token}"},
            json={"raw": raw},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Gmail send failed: {resp.text}")
    return resp.json().get("id", "")


def _render_pairing_body(body_template: str, applicant: CoffeeChatApplicant, member_first: str,
                          member_last: str, member_major: str, member_year: str,
                          sender_name: str, sender_title: str) -> str:
    applicant_first = applicant.name.split(" ")[0] if applicant.name else applicant.name
    applicant_year = _grad_date_to_year(applicant.grad_date or "")
    applicant_major = applicant.major or ""

    replacements = {
        "{{applicant_first}}": applicant_first,
        "{{applicant_year}}": applicant_year,
        "{{applicant_major}}": applicant_major,
        "{{member_first}}": member_first,
        "{{member_last}}": member_last,
        "{{member_year}}": member_year,
        "{{member_major}}": member_major,
        "{{sender_name}}": sender_name,
        "{{sender_title}}": sender_title,
    }
    result = body_template
    for k, v in replacements.items():
        result = result.replace(k, v)
    return result


def _render_rejection_body(body_template: str, applicant: CoffeeChatApplicant,
                            sender_name: str, sender_title: str) -> str:
    applicant_first = applicant.name.split(" ")[0] if applicant.name else applicant.name
    replacements = {
        "{{applicant_first}}": applicant_first,
        "{{sender_name}}": sender_name,
        "{{sender_title}}": sender_title,
    }
    result = body_template
    for k, v in replacements.items():
        result = result.replace(k, v)
    return result


DEFAULT_PAIRING_BODY = """<p>Hello {{applicant_first}},</p>
<p>Thank you for your interest in Cornell Business Analytics (CBA) at Cornell. According to the information you provided on the coffee chat form, you have been paired with {{member_first}} {{member_last}}, a {{member_year}} majoring in {{member_major}}, who is copied on this email. Please reach out to {{member_first}} with your availability for specific dates and times to schedule a meeting.</p>
<p>{{member_first}}, {{applicant_first}} is a {{applicant_year}} majoring in {{applicant_major}}.</p>
<p>Again, thank you for your interest in CBA. We hope to see your application this semester!</p>
<p>Best regards,</p>
<p><b>{{sender_name}}</b><br>{{sender_title}}</p>"""

DEFAULT_REJECTION_BODY = """<p>Hello {{applicant_first}},</p>
<p>Thank you for your interest in Cornell Business Analytics. We regret to inform you that our members no longer have adequate availability to field your coffee chat request before interview rounds start. We recognize that this is not ideal, so I invite you to reach out to me with any questions you have about CBA.</p>
<p>My apologies,</p>
<p><b>{{sender_name}}</b><br>{{sender_title}}</p>"""


# ---------------------------------------------------------------------------
# Gmail OAuth
# ---------------------------------------------------------------------------

@router.get("/gmail-auth-url")
async def gmail_auth_url(_: User = Depends(require_role(UserRole.eboard))):
    if not settings.GMAIL_CLIENT_ID:
        raise HTTPException(status_code=503, detail="GMAIL_CLIENT_ID not configured")
    url = (
        f"{GOOGLE_AUTH_URL}"
        f"?client_id={settings.GMAIL_CLIENT_ID}"
        f"&redirect_uri={settings.GMAIL_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={GMAIL_SCOPES.replace(' ', '%20')}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return {"url": url}


@router.get("/gmail-callback")
async def gmail_callback(code: str = Query(...), db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GMAIL_CLIENT_ID,
            "client_secret": settings.GMAIL_CLIENT_SECRET,
            "redirect_uri": settings.GMAIL_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {resp.text}")

    data = resp.json()
    from datetime import timedelta
    expiry = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600) - 60)

    # Get email address
    account_email = None
    async with httpx.AsyncClient() as client:
        info = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {data['access_token']}"},
        )
        if info.status_code == 200:
            account_email = info.json().get("email")

    result = await db.execute(select(GmailToken).limit(1))
    token = result.scalar_one_or_none()
    if token:
        token.access_token = data["access_token"]
        token.refresh_token = data.get("refresh_token", token.refresh_token)
        token.token_expiry = expiry
        token.account_email = account_email
    else:
        token = GmailToken(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            token_expiry=expiry,
            account_email=account_email,
        )
        db.add(token)
    await db.commit()

    frontend_url = settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else "http://localhost:3000"
    return RedirectResponse(url=f"{frontend_url}/recruitment?gmail=connected")


@router.get("/gmail-status")
async def gmail_status(
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GmailToken).limit(1))
    token = result.scalar_one_or_none()
    if not token:
        return {"connected": False, "account_email": None}
    return {"connected": True, "account_email": token.account_email}


# ---------------------------------------------------------------------------
# Recruitment Cycles
# ---------------------------------------------------------------------------

class CycleCreate(BaseModel):
    name: str
    sheet_id: str | None = None
    sender_name: str = ""
    sender_title: str = "Director of Recruitment"


class CycleUpdate(BaseModel):
    name: str | None = None
    sheet_id: str | None = None
    sender_name: str | None = None
    sender_title: str | None = None
    pairing_subject: str | None = None
    pairing_body: str | None = None
    rejection_subject: str | None = None
    rejection_body: str | None = None
    is_active: bool | None = None


class CyclePublic(BaseModel):
    id: uuid.UUID
    name: str
    sheet_id: str | None
    sender_name: str
    sender_title: str
    pairing_subject: str
    pairing_body: str
    rejection_subject: str
    rejection_body: str
    is_active: bool
    applicant_count: int = 0
    model_config = {"from_attributes": True}


@router.get("/cycles", response_model=list[CyclePublic])
async def list_cycles(
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecruitmentCycle).order_by(RecruitmentCycle.created_at.desc())
    )
    cycles = result.scalars().all()
    out = []
    for c in cycles:
        count_result = await db.execute(
            select(CoffeeChatApplicant).where(CoffeeChatApplicant.cycle_id == c.id)
        )
        count = len(count_result.scalars().all())
        out.append(CyclePublic(
            id=c.id, name=c.name, sheet_id=c.sheet_id,
            sender_name=c.sender_name, sender_title=c.sender_title,
            pairing_subject=c.pairing_subject, pairing_body=c.pairing_body,
            rejection_subject=c.rejection_subject, rejection_body=c.rejection_body,
            is_active=c.is_active, applicant_count=count,
        ))
    return out


@router.post("/cycles", response_model=CyclePublic, status_code=201)
async def create_cycle(
    body: CycleCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    cycle = RecruitmentCycle(
        name=body.name,
        sheet_id=body.sheet_id,
        sender_name=body.sender_name,
        sender_title=body.sender_title,
        pairing_body=DEFAULT_PAIRING_BODY,
        rejection_body=DEFAULT_REJECTION_BODY,
    )
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return CyclePublic(
        id=cycle.id, name=cycle.name, sheet_id=cycle.sheet_id,
        sender_name=cycle.sender_name, sender_title=cycle.sender_title,
        pairing_subject=cycle.pairing_subject, pairing_body=cycle.pairing_body,
        rejection_subject=cycle.rejection_subject, rejection_body=cycle.rejection_body,
        is_active=cycle.is_active, applicant_count=0,
    )


@router.patch("/cycles/{cycle_id}", response_model=CyclePublic)
async def update_cycle(
    cycle_id: uuid.UUID,
    body: CycleUpdate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RecruitmentCycle).where(RecruitmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cycle, field, value)
    await db.commit()
    await db.refresh(cycle)
    count_result = await db.execute(
        select(CoffeeChatApplicant).where(CoffeeChatApplicant.cycle_id == cycle.id)
    )
    count = len(count_result.scalars().all())
    return CyclePublic(
        id=cycle.id, name=cycle.name, sheet_id=cycle.sheet_id,
        sender_name=cycle.sender_name, sender_title=cycle.sender_title,
        pairing_subject=cycle.pairing_subject, pairing_body=cycle.pairing_body,
        rejection_subject=cycle.rejection_subject, rejection_body=cycle.rejection_body,
        is_active=cycle.is_active, applicant_count=count,
    )


# ---------------------------------------------------------------------------
# Import from Google Sheet
# ---------------------------------------------------------------------------

class ColumnMapping(BaseModel):
    name_col: str = "Full Name"
    email_col: str = "Cornell Email Address"
    grad_col: str = "Graduation Date"
    major_col: str = "Intended Major(s)"
    request_col: str = "Paired Member"
    timestamp_col: str = "Timestamp"  # Google Forms always prepends this column


@router.post("/cycles/{cycle_id}/import")
async def import_from_sheet(
    cycle_id: uuid.UUID,
    mapping: ColumnMapping,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RecruitmentCycle).where(RecruitmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    if not cycle.sheet_id:
        raise HTTPException(status_code=400, detail="No Google Sheet ID set for this cycle")

    token = await _get_valid_token(db)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{cycle.sheet_id}/values/A1:Z",
            headers={"Authorization": f"Bearer {token.access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {resp.text}")

    values = resp.json().get("values", [])
    if len(values) < 2:
        return {"imported": 0, "skipped": 0}

    headers = [h.strip() for h in values[0]]
    rows = values[1:]

    def col(row: list, name: str) -> str:
        try:
            idx = headers.index(name)
            return row[idx].strip() if idx < len(row) else ""
        except ValueError:
            return ""

    imported = 0
    skipped = 0
    for i, row in enumerate(rows):
        email = col(row, mapping.email_col)
        if not email:
            skipped += 1
            continue
        netid = email.split("@")[0].strip().lower()

        # Dedup key: netid + timestamp — allows same person to request multiple chats
        timestamp = col(row, mapping.timestamp_col) or str(i)
        row_key = f"{netid}_{timestamp}"

        existing = await db.execute(
            select(CoffeeChatApplicant).where(
                CoffeeChatApplicant.cycle_id == cycle_id,
                CoffeeChatApplicant.row_key == row_key,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        applicant = CoffeeChatApplicant(
            cycle_id=cycle_id,
            name=col(row, mapping.name_col),
            email=email,
            netid=netid,
            grad_date=col(row, mapping.grad_col) or None,
            major=col(row, mapping.major_col) or None,
            requested_member_raw=col(row, mapping.request_col) or None,
            row_key=row_key,
        )
        db.add(applicant)
        imported += 1

    await db.commit()
    return {"imported": imported, "skipped": skipped}


@router.get("/cycles/{cycle_id}/sheet-columns")
async def get_sheet_columns(
    cycle_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    """Returns the header row from the sheet so the user can map columns."""
    result = await db.execute(select(RecruitmentCycle).where(RecruitmentCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle or not cycle.sheet_id:
        raise HTTPException(status_code=400, detail="Cycle has no sheet ID")

    token = await _get_valid_token(db)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{cycle.sheet_id}/values/A1:Z1",
            headers={"Authorization": f"Bearer {token.access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {resp.text}")

    values = resp.json().get("values", [[]])
    return {"columns": [h.strip() for h in (values[0] if values else [])]}


# ---------------------------------------------------------------------------
# Applicants
# ---------------------------------------------------------------------------

class ApplicantPublic(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    netid: str
    grad_date: str | None
    major: str | None
    requested_member_raw: str | None
    notes: str | None
    paired_membership_id: uuid.UUID | None
    paired_member_name: str | None = None
    pairing_status: str
    gmail_message_id: str | None
    sent_at: datetime | None
    model_config = {"from_attributes": True}


class PairingUpdate(BaseModel):
    membership_id: uuid.UUID | None = None
    notes: str | None = None


@router.get("/cycles/{cycle_id}/applicants", response_model=list[ApplicantPublic])
async def list_applicants(
    cycle_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoffeeChatApplicant)
        .options(selectinload(CoffeeChatApplicant.paired_membership).selectinload(Membership.user))
        .where(CoffeeChatApplicant.cycle_id == cycle_id)
        .order_by(CoffeeChatApplicant.created_at)
    )
    applicants = result.scalars().all()
    out = []
    for a in applicants:
        member_name = None
        if a.paired_membership and a.paired_membership.user:
            member_name = a.paired_membership.user.name
        out.append(ApplicantPublic(
            id=a.id, name=a.name, email=a.email, netid=a.netid,
            grad_date=a.grad_date, major=a.major,
            requested_member_raw=a.requested_member_raw, notes=a.notes,
            paired_membership_id=a.paired_membership_id,
            paired_member_name=member_name,
            pairing_status=a.pairing_status,
            gmail_message_id=a.gmail_message_id, sent_at=a.sent_at,
        ))
    return out


@router.patch("/cycles/{cycle_id}/applicants/{applicant_id}/pairing")
async def update_pairing(
    cycle_id: uuid.UUID,
    applicant_id: uuid.UUID,
    body: PairingUpdate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoffeeChatApplicant).where(
            CoffeeChatApplicant.id == applicant_id,
            CoffeeChatApplicant.cycle_id == cycle_id,
        )
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    if body.membership_id is not None:
        applicant.paired_membership_id = body.membership_id
        if applicant.pairing_status == "unpaired":
            applicant.pairing_status = "paired"
    if body.notes is not None:
        applicant.notes = body.notes
    await db.commit()
    return {"ok": True}


@router.delete("/cycles/{cycle_id}/applicants/{applicant_id}/pairing")
async def remove_pairing(
    cycle_id: uuid.UUID,
    applicant_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoffeeChatApplicant).where(
            CoffeeChatApplicant.id == applicant_id,
            CoffeeChatApplicant.cycle_id == cycle_id,
        )
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    applicant.paired_membership_id = None
    applicant.pairing_status = "unpaired"
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------

@router.post("/cycles/{cycle_id}/applicants/{applicant_id}/mark-sent")
async def mark_sent_manually(
    cycle_id: uuid.UUID,
    applicant_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    """Mark a coffee chat as sent without emailing — for manually handled pairings."""
    result = await db.execute(
        select(CoffeeChatApplicant).where(
            CoffeeChatApplicant.id == applicant_id,
            CoffeeChatApplicant.cycle_id == cycle_id,
        )
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    applicant.pairing_status = "sent"
    applicant.sent_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/cycles/{cycle_id}/applicants/{applicant_id}/send-pairing-email")
async def send_pairing_email(
    cycle_id: uuid.UUID,
    applicant_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoffeeChatApplicant)
        .options(selectinload(CoffeeChatApplicant.paired_membership).selectinload(Membership.user))
        .where(CoffeeChatApplicant.id == applicant_id, CoffeeChatApplicant.cycle_id == cycle_id)
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    if not applicant.paired_membership_id:
        raise HTTPException(status_code=400, detail="No member paired yet")
    if applicant.pairing_status == "sent":
        raise HTTPException(status_code=409, detail="Email already sent for this applicant")

    cycle_result = await db.execute(select(RecruitmentCycle).where(RecruitmentCycle.id == cycle_id))
    cycle = cycle_result.scalar_one_or_none()

    member = applicant.paired_membership
    member_user = member.user
    member_first = member_user.name.split(" ")[0] if member_user.name else ""
    member_last = member_user.name.split(" ", 1)[1] if " " in (member_user.name or "") else ""
    member_major = member.major or ""
    member_year = _grad_date_to_year(member.grad_year or "")

    effective_sender = cycle.sender_name or current_user.name
    body_html = _render_pairing_body(
        cycle.pairing_body, applicant,
        member_first, member_last, member_major, member_year,
        effective_sender, cycle.sender_title,
    )

    token = await _get_valid_token(db)
    member_email = f"{member_user.email}"
    msg_id = await _send_gmail(
        token,
        to=applicant.email,
        cc=member_email,
        subject=cycle.pairing_subject,
        body_html=body_html,
    )

    applicant.pairing_status = "sent"
    applicant.gmail_message_id = msg_id
    applicant.sent_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "gmail_message_id": msg_id}


@router.post("/cycles/{cycle_id}/applicants/{applicant_id}/send-rejection-email")
async def send_rejection_email(
    cycle_id: uuid.UUID,
    applicant_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoffeeChatApplicant).where(
            CoffeeChatApplicant.id == applicant_id, CoffeeChatApplicant.cycle_id == cycle_id
        )
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    if applicant.pairing_status == "sent":
        raise HTTPException(status_code=409, detail="Pairing email already sent")

    cycle_result = await db.execute(select(RecruitmentCycle).where(RecruitmentCycle.id == cycle_id))
    cycle = cycle_result.scalar_one_or_none()

    effective_sender = cycle.sender_name or current_user.name
    body_html = _render_rejection_body(cycle.rejection_body, applicant, effective_sender, cycle.sender_title)

    token = await _get_valid_token(db)
    msg_id = await _send_gmail(
        token,
        to=applicant.email,
        cc=None,
        subject=cycle.rejection_subject,
        body_html=body_html,
    )

    applicant.pairing_status = "rejected"
    applicant.gmail_message_id = msg_id
    applicant.sent_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "gmail_message_id": msg_id}


@router.post("/cycles/{cycle_id}/applicants/{applicant_id}/reset-status")
async def reset_email_status(
    cycle_id: uuid.UUID,
    applicant_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    """Eboard only — resets status so an email can be resent if needed."""
    result = await db.execute(
        select(CoffeeChatApplicant).where(
            CoffeeChatApplicant.id == applicant_id, CoffeeChatApplicant.cycle_id == cycle_id
        )
    )
    applicant = result.scalar_one_or_none()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    applicant.pairing_status = "paired" if applicant.paired_membership_id else "unpaired"
    applicant.gmail_message_id = None
    applicant.sent_at = None
    await db.commit()
    return {"ok": True}
