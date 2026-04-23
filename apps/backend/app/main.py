from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from app.core.config import settings
from app.core.middleware import RequestTimingMiddleware, add_cors
from app.db.session import engine
from app.modules.ops.router import router as ops_router
from app.modules.web.router import router as web_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", env=settings.APP_ENV)
    yield
    await engine.dispose()
    logger.info("shutdown")


app = FastAPI(
    title="CBA Platform API",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

add_cors(app)
app.add_middleware(RequestTimingMiddleware)

app.include_router(web_router, prefix="/web/v1")
app.include_router(ops_router, prefix="/ops/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}
