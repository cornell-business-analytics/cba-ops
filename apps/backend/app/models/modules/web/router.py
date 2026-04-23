from fastapi import APIRouter

router = APIRouter(tags=["web"])


@router.get("/health")
async def web_health():
    return {"status": "ok"}
