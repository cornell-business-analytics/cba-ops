from fastapi import APIRouter

router = APIRouter(tags=["ops"])


@router.get("/health")
async def ops_health():
    return {"status": "ok"}
