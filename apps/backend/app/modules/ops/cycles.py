import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.candidate import (
    ApplicationCycle,
    Candidate,
    InterviewCategory,
    InterviewRound,
    InterviewScore,
    InterviewSession,
)
from app.models.user import User as UserModel
from app.models.user import User, UserRole
from app.modules.ops.deps import get_current_user, require_role
from app.modules.ops.recruitment import _extract_sheet_id, _get_valid_token
from app.schemas.cycle import (
    CycleCreate,
    CyclePublic,
    CycleUpdate,
    InterviewRoundCreate,
    InterviewRoundPublic,
    InterviewRoundUpdate,
    InterviewSessionCreate,
    InterviewSessionPublic,
)
from app.services.images import normalize_image

router = APIRouter(tags=["cycles"])


# ---------------------------------------------------------------------------
# Application cycles
# ---------------------------------------------------------------------------

@router.get("/cycles", response_model=list[CyclePublic])
async def list_cycles(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).order_by(ApplicationCycle.name))
    return result.scalars().all()


@router.post("/cycles", response_model=CyclePublic, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    body: CycleCreate,
    _: User = Depends(require_role(UserRole.recruitment)),
    db: AsyncSession = Depends(get_db),
):
    cycle = ApplicationCycle(**body.model_dump())
    db.add(cycle)
    await db.commit()
    await db.refresh(cycle)
    return cycle


@router.patch("/cycles/{cycle_id}", response_model=CyclePublic)
async def update_cycle(
    cycle_id: uuid.UUID,
    body: CycleUpdate,
    _: User = Depends(require_role(UserRole.recruitment)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cycle, field, value)
    await db.commit()
    await db.refresh(cycle)
    return cycle


# ---------------------------------------------------------------------------
# Interview rounds
# ---------------------------------------------------------------------------

@router.get("/cycles/{cycle_id}/rounds", response_model=list[InterviewRoundPublic])
async def list_rounds(
    cycle_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.cycle_id == cycle_id)
        .options(selectinload(InterviewRound.categories))
        .order_by(InterviewRound.round_number)
    )
    return result.scalars().all()


@router.post(
    "/cycles/{cycle_id}/rounds",
    response_model=InterviewRoundPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_round(
    cycle_id: uuid.UUID,
    body: InterviewRoundCreate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    round_ = InterviewRound(
        cycle_id=cycle_id,
        round_number=body.round_number,
        name=body.name,
        score_format=body.score_format,
        interview_format=body.interview_format,
        is_default=body.is_default,
    )
    db.add(round_)
    await db.flush()

    for cat in body.categories:
        db.add(InterviewCategory(round_id=round_.id, **cat.model_dump()))

    await db.commit()
    await db.refresh(round_)

    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.id == round_.id)
        .options(selectinload(InterviewRound.categories))
    )
    return result.scalar_one()


@router.delete("/rounds/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round(
    round_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewRound).where(InterviewRound.id == round_id))
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    await db.delete(round_)
    await db.commit()


@router.patch("/rounds/{round_id}", response_model=InterviewRoundPublic)
async def update_round(
    round_id: uuid.UUID,
    body: InterviewRoundUpdate,
    _: User = Depends(require_role(UserRole.eboard)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.id == round_id)
        .options(selectinload(InterviewRound.categories))
    )
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(round_, field, value)
    await db.commit()
    await db.refresh(round_)
    result2 = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.id == round_id)
        .options(selectinload(InterviewRound.categories))
    )
    return result2.scalar_one()


# ---------------------------------------------------------------------------
# Interview sessions
# ---------------------------------------------------------------------------

@router.get("/rounds/{round_id}/sessions", response_model=list[InterviewSessionPublic])
async def list_sessions(
    round_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.round_id == round_id)
        .order_by(InterviewSession.time_slot)
    )
    return result.scalars().all()


@router.post(
    "/rounds/{round_id}/sessions",
    response_model=InterviewSessionPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    round_id: uuid.UUID,
    body: InterviewSessionCreate,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    session = InterviewSession(round_id=round_id, **body.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


# ---------------------------------------------------------------------------
# Interview score import from Google Sheet
# ---------------------------------------------------------------------------



@dataclass
class ScoreRecord:
    tab_name: str
    group_number: int
    member_name: str
    candidate_name: str
    social_fit: float | None
    cba_interest: float | None
    career_ambitions: float | None
    comments: str | None


CATEGORY_NAMES = ["Social Fit", "CBA Interest", "Career Ambitions"]
SKIP_KEYWORDS = {"social fit", "cba interest", "career ambitions", "scores only below",
                  "all comments", "experiences", "experience", "comments", "name"}


def _safe_float(val: str) -> float | None:
    try:
        return float(val.strip()) if val.strip() else None
    except ValueError:
        return None


def _parse_scoring_tab(rows: list[list[str]], tab_name: str) -> list[ScoreRecord]:
    """State-machine parser for a freeform interview scoring tab."""
    records: list[ScoreRecord] = []

    # State
    group_number: int | None = None
    member_names: list[str] = []
    # col indices per scorer: (social_fit_col, cba_interest_col, career_ambitions_col, comments_col)
    scorer_cols: list[tuple[int, int, int, int]] = []
    in_candidates = False
    name_col: int = 0

    GROUP_RE = re.compile(r"GROUP\s*(\d+)", re.IGNORECASE)
    CATEGORY_RE = re.compile(r"social\s*fit", re.IGNORECASE)

    for row in rows:
        # Normalize: extend short rows
        row = list(row) + [""] * max(0, 20 - len(row))

        # Check for group label row
        row_text = " ".join(row)
        group_match = GROUP_RE.search(row_text)
        if group_match:
            group_number = int(group_match.group(1))
            member_names = []
            scorer_cols = []
            in_candidates = False
            continue

        if group_number is None:
            continue

        # Check for category header row (contains "Social Fit")
        if CATEGORY_RE.search(row_text) and not in_candidates:
            # Find column indices for each scorer block
            # A scorer block starts wherever we find "Social Fit"
            scorer_cols = []
            i = 0
            while i < len(row):
                if re.search(r"social\s*fit", row[i], re.IGNORECASE):
                    sf = i
                    cba = i + 1
                    ca = i + 2
                    cmts = i + 3
                    scorer_cols.append((sf, cba, ca, cmts))
                    i += 4
                else:
                    i += 1
            continue

        # Check for "scores only below" row — next rows are candidates
        if "scores only below" in row_text.lower():
            in_candidates = True
            continue

        # Member name row: appears between group label and category header
        # Heuristic: row has 3+ non-empty cells, none are category keywords, and scorer_cols not yet set
        if not scorer_cols and member_names == [] and not in_candidates:
            non_empty = [c.strip() for c in row if c.strip()]
            if len(non_empty) >= 2 and not any(
                k in c.lower() for c in non_empty for k in SKIP_KEYWORDS
            ):
                # These are likely member names — find which columns they're in
                member_names = [c for c in non_empty]
            continue

        # Candidate rows
        if in_candidates and scorer_cols:
            # Name is in first non-empty column
            candidate_name = ""
            for i, cell in enumerate(row[:4]):
                if cell.strip() and cell.strip().lower() not in SKIP_KEYWORDS:
                    candidate_name = cell.strip()
                    name_col = i
                    break

            if not candidate_name:
                # Blank row — end of this group block
                if any(c.strip() for c in row):
                    continue  # non-blank, non-candidate row — skip
                group_number = None
                in_candidates = False
                continue

            # Extract scores per scorer
            for idx, (sf_col, cba_col, ca_col, cmt_col) in enumerate(scorer_cols):
                member_name = member_names[idx] if idx < len(member_names) else f"Scorer {idx+1}"
                records.append(ScoreRecord(
                    tab_name=tab_name,
                    group_number=group_number,
                    member_name=member_name,
                    candidate_name=candidate_name,
                    social_fit=_safe_float(row[sf_col]) if sf_col < len(row) else None,
                    cba_interest=_safe_float(row[cba_col]) if cba_col < len(row) else None,
                    career_ambitions=_safe_float(row[ca_col]) if ca_col < len(row) else None,
                    comments=row[cmt_col].strip() or None if cmt_col < len(row) else None,
                ))

    return records


class ScoreImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    missing_candidates: list[str]
    missing_members: list[str]


@router.post("/rounds/{round_id}/import-scores", response_model=ScoreImportResult)
async def import_round_scores(
    round_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    # Load round with categories
    result = await db.execute(
        select(InterviewRound)
        .where(InterviewRound.id == round_id)
        .options(selectinload(InterviewRound.categories))
    )
    round_ = result.scalar_one_or_none()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    if not round_.score_sheet_url:
        raise HTTPException(status_code=400, detail="No score sheet URL configured for this round")

    token = await _get_valid_token(current_user.id, db)
    sheet_id = _extract_sheet_id(round_.score_sheet_url)

    # List all tabs
    async with httpx.AsyncClient(timeout=30) as client:
        meta = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    if meta.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Sheets API error: {meta.text[:200]}")

    all_tabs = [s["properties"]["title"] for s in meta.json().get("sheets", [])]
    # Filter to scoring tabs: pattern "D1 5PM", "D2 6PM", etc.
    TAB_RE = re.compile(r"D\d+\s+\d+(AM|PM)", re.IGNORECASE)
    scoring_tabs = [t for t in all_tabs if TAB_RE.search(t)]

    if not scoring_tabs:
        raise HTTPException(status_code=400, detail=f"No scoring tabs found. Tabs: {all_tabs}")

    # Ensure categories exist for this round
    cat_names = {c.name: c.id for c in round_.categories}
    for cat_name in CATEGORY_NAMES:
        if cat_name not in cat_names:
            cat = InterviewCategory(round_id=round_id, name=cat_name, display_order=CATEGORY_NAMES.index(cat_name))
            db.add(cat)
            await db.flush()
            cat_names[cat_name] = cat.id

    # Cache: sessions, candidates, members
    session_cache: dict[str, uuid.UUID] = {}
    candidate_cache: dict[str, uuid.UUID | None] = {}
    member_cache: dict[str, uuid.UUID | None] = {}

    # Load all candidates in this cycle
    cycle_result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == round_.cycle_id))
    cycle = cycle_result.scalar_one()
    cands_result = await db.execute(
        select(Candidate).where(Candidate.cycle_id == cycle.id)
    )
    for c in cands_result.scalars().all():
        candidate_cache[c.name.lower()] = c.id

    # Load all users
    users_result = await db.execute(select(UserModel))
    for u in users_result.scalars().all():
        member_cache[u.name.lower()] = u.id

    imported = updated = skipped = 0
    missing_candidates: set[str] = set()
    missing_members: set[str] = set()

    for tab_name in scoring_tabs:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{tab_name}!A:ZZ",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code != 200:
            continue

        rows = resp.json().get("values", [])
        records = _parse_scoring_tab(rows, tab_name)

        for rec in records:
            candidate_id = candidate_cache.get(rec.candidate_name.lower())
            if candidate_id is None:
                missing_candidates.add(rec.candidate_name)
                skipped += 1
                continue

            member_id = member_cache.get(rec.member_name.lower())
            if member_id is None:
                missing_members.add(rec.member_name)
                skipped += 1
                continue

            # Find or create session
            session_key = f"{tab_name}|GROUP {rec.group_number}"
            if session_key not in session_cache:
                sess_result = await db.execute(
                    select(InterviewSession).where(
                        InterviewSession.round_id == round_id,
                        InterviewSession.group_label == f"GROUP {rec.group_number}",
                        InterviewSession.time_slot == tab_name,
                    )
                )
                sess = sess_result.scalar_one_or_none()
                if not sess:
                    sess = InterviewSession(
                        round_id=round_id,
                        group_label=f"GROUP {rec.group_number}",
                        time_slot=tab_name,
                    )
                    db.add(sess)
                    await db.flush()
                session_cache[session_key] = sess.id
            session_id = session_cache[session_key]

            # Upsert one score row per category
            now = datetime.now(timezone.utc)
            score_data = [
                (cat_names["Social Fit"], rec.social_fit, rec.comments),
                (cat_names["CBA Interest"], rec.cba_interest, None),
                (cat_names["Career Ambitions"], rec.career_ambitions, None),
            ]
            for cat_id, score_val, comments in score_data:
                stmt = pg_insert(InterviewScore).values(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    candidate_id=candidate_id,
                    member_id=member_id,
                    category_id=cat_id,
                    numeric_score=score_val,
                    comments=comments,
                    created_at=now,
                    updated_at=now,
                ).on_conflict_do_update(
                    constraint="uq_interview_score",
                    set_={"numeric_score": score_val, "comments": comments, "updated_at": now},
                )
                await db.execute(stmt)
                imported += 1

    await db.commit()
    return ScoreImportResult(
        imported=imported,
        updated=updated,
        skipped=skipped,
        missing_candidates=sorted(missing_candidates),
        missing_members=sorted(missing_members),
    )


# ---------------------------------------------------------------------------
# Candidate import from Google Sheet
# ---------------------------------------------------------------------------

class CandidateColumnMapping(BaseModel):
    timestamp_col: str = "Timestamp"
    personal_email_col: str = "Email Address"
    cornell_email_col: str = "Cornell Email"
    name_col: str = "Name"
    pronouns_col: str = "Pronouns"
    netid_col: str = "NetID"
    year_col: str = "Year"
    transfer_col: str = "Are you a transfer student?"
    college_col: str = "College"
    major_col: str = "Major(s)"
    headshot_col: str = "Please upload a headshot"
    gender_col: str = "How do you identify?"
    ethnicity_col: str = "How do you identify?.1"


class ImportResult(BaseModel):
    imported: int
    updated: int
    skipped: int
    missing_cols: list[str]


def _extract_drive_file_id(url: str) -> str | None:
    """Extract Google Drive file ID from various URL formats."""
    if not url:
        return None
    # https://drive.google.com/file/d/FILE_ID/view
    if "/file/d/" in url:
        part = url.split("/file/d/")[1]
        return part.split("/")[0].split("?")[0]
    # https://drive.google.com/open?id=FILE_ID
    if "open?id=" in url:
        return url.split("open?id=")[1].split("&")[0]
    # https://drive.google.com/uc?id=FILE_ID
    if "uc?id=" in url:
        return url.split("uc?id=")[1].split("&")[0]
    return None


def _get_r2_client() -> Any:
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


async def _download_and_store_headshot(
    drive_url: str, cycle_id: str, token: str
) -> str | None:
    """Download headshot from Drive, normalize, upload to R2. Returns public URL or None."""
    file_id = _extract_drive_file_id(drive_url)
    if not file_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
                headers={"Authorization": f"Bearer {token}"},
                follow_redirects=True,
            )
        if r.status_code != 200:
            return None
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0]
        if not content_type.startswith("image/"):
            return None
        try:
            normalized, stored_type = normalize_image(r.content, content_type, "headshot")
        except ValueError:
            return None
        ext = "webp" if stored_type == "image/webp" else "jpg"
        key = f"uploads/candidates/{cycle_id}/{uuid.uuid4()}.{ext}"
        if not settings.R2_ACCESS_KEY_ID:
            return None
        _get_r2_client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=normalized,
            ContentType=stored_type or "image/webp",
        )
        return f"{settings.R2_PUBLIC_URL}/{key}"
    except Exception:
        return None


@router.post("/cycles/{cycle_id}/import", response_model=ImportResult)
async def import_candidates(
    cycle_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.recruitment)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    if not cycle.sheet_url:
        raise HTTPException(status_code=400, detail="No sheet URL configured for this cycle")

    token = await _get_valid_token(current_user.id, db)
    sheet_id = _extract_sheet_id(cycle.sheet_url)

    # Overlay stored column mapping onto defaults
    col_map = CandidateColumnMapping(**(cycle.column_mapping or {}))

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/A:ZZ",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {resp.text[:200]}")

    data = resp.json()
    rows = data.get("values", [])
    if len(rows) < 2:
        return ImportResult(imported=0, updated=0, skipped=0, missing_cols=[])

    headers = rows[0]

    def col(name: str) -> int | None:
        try:
            return headers.index(name)
        except ValueError:
            # prefix match for long Google Form headers
            name_lower = name.lower()
            for i, h in enumerate(headers):
                if h.lower().startswith(name_lower):
                    return i
            return None

    def val(row: list[str], idx: int | None) -> str:
        if idx is None or idx >= len(row):
            return ""
        return row[idx].strip()

    # Find all column indices
    col_indices = {
        "timestamp": col(col_map.timestamp_col),
        "personal_email": col(col_map.personal_email_col),
        "cornell_email": col(col_map.cornell_email_col),
        "name": col(col_map.name_col),
        "pronouns": col(col_map.pronouns_col),
        "netid": col(col_map.netid_col),
        "year": col(col_map.year_col),
        "transfer": col(col_map.transfer_col),
        "college": col(col_map.college_col),
        "major": col(col_map.major_col),
        "headshot": col(col_map.headshot_col),
        "gender": col(col_map.gender_col),
        "ethnicity": col(col_map.ethnicity_col),
    }

    missing_cols = [
        name for field, name in [
            ("timestamp", col_map.timestamp_col),
            ("personal_email", col_map.personal_email_col),
            ("cornell_email", col_map.cornell_email_col),
            ("name", col_map.name_col),
            ("netid", col_map.netid_col),
        ]
        if col_indices[field] is None
    ]

    imported = updated = skipped = 0

    for i, row in enumerate(rows[1:], start=1):
        netid_raw = val(row, col_indices["netid"]).lower().split("@")[0]
        if not netid_raw:
            skipped += 1
            continue

        # Look for existing candidate by net_id in this cycle
        existing_result = await db.execute(
            select(Candidate).where(
                Candidate.cycle_id == cycle_id,
                Candidate.net_id == netid_raw,
            )
        )
        candidate = existing_result.scalar_one_or_none()

        college_raw = val(row, col_indices["college"])
        college_list = [v.strip() for v in college_raw.split(",") if v.strip()] if college_raw else []

        ethnicity_raw = val(row, col_indices["ethnicity"])
        ethnicity_list = [v.strip() for v in ethnicity_raw.split(",") if v.strip()] if ethnicity_raw else []

        transfer_raw = val(row, col_indices["transfer"])
        is_transfer = transfer_raw.lower().startswith("y") if transfer_raw else False

        # Download headshot if we don't have one yet (or always update on re-import)
        headshot_url: str | None = candidate.headshot_url if candidate else None
        headshot_raw = val(row, col_indices["headshot"])
        if headshot_raw and ("drive.google.com" in headshot_raw):
            new_url = await _download_and_store_headshot(headshot_raw, str(cycle_id), token)
            if new_url:
                headshot_url = new_url

        fields = {
            "name": val(row, col_indices["name"]) or (candidate.name if candidate else ""),
            "email": val(row, col_indices["personal_email"]),
            "cornell_email": val(row, col_indices["cornell_email"]),
            "net_id": netid_raw,
            "pronouns": val(row, col_indices["pronouns"]) or None,
            "grad_year": val(row, col_indices["year"]) or None,
            "is_transfer": is_transfer,
            "college": college_list,
            "major": val(row, col_indices["major"]) or None,
            "gender_identity": val(row, col_indices["gender"]) or None,
            "ethnicity": ethnicity_list,
            "headshot_url": headshot_url,
        }

        if candidate:
            for k, v in fields.items():
                setattr(candidate, k, v)
            updated += 1
        else:
            candidate = Candidate(cycle_id=cycle_id, status="applied", **fields)
            db.add(candidate)
            imported += 1

    await db.commit()
    return ImportResult(imported=imported, updated=updated, skipped=skipped, missing_cols=missing_cols)


# ---------------------------------------------------------------------------
# Headshot purge
# ---------------------------------------------------------------------------

class HeadshotPurgeResult(BaseModel):
    deleted: int


@router.delete("/cycles/{cycle_id}/headshots", response_model=HeadshotPurgeResult)
async def purge_headshots(
    cycle_id: uuid.UUID,
    _: User = Depends(require_role(UserRole.director)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApplicationCycle).where(ApplicationCycle.id == cycle_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cycle not found")

    if not settings.R2_ACCESS_KEY_ID:
        raise HTTPException(status_code=503, detail="Asset storage not configured")

    prefix = f"uploads/candidates/{cycle_id}/"
    r2 = _get_r2_client()

    # List all objects under the cycle's prefix
    keys_to_delete: list[dict] = []
    paginator = r2.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys_to_delete.append({"Key": obj["Key"]})

    deleted = len(keys_to_delete)

    # Batch delete (R2 supports up to 1000 per call)
    for i in range(0, len(keys_to_delete), 1000):
        batch = keys_to_delete[i:i + 1000]
        r2.delete_objects(Bucket=settings.R2_BUCKET_NAME, Delete={"Objects": batch})

    # Clear headshot_url on all candidates in this cycle
    cands_result = await db.execute(
        select(Candidate).where(Candidate.cycle_id == cycle_id, Candidate.headshot_url.isnot(None))
    )
    for candidate in cands_result.scalars().all():
        candidate.headshot_url = None

    await db.commit()
    return HeadshotPurgeResult(deleted=deleted)
