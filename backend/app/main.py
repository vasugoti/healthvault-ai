"""
HealthVault AI — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import engine, Base
from app.storage import ensure_bucket_exists
from app.routers import auth, documents, processing, metrics, assistant, timeline, search, medications, reminders, feedback, settings as settings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
app_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables, ensure MinIO bucket exists."""
    logger.info("Starting HealthVault AI backend...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notify_before_days INTEGER DEFAULT 1;"))
    try:
        ensure_bucket_exists()
        logger.info("MinIO bucket ready.")
    except Exception as e:
        logger.warning(f"MinIO initialization warning: {e}")
    logger.info("HealthVault AI backend ready.")
    yield
    logger.info("Shutting down HealthVault AI backend...")
    await engine.dispose()


app = FastAPI(
    title="HealthVault AI",
    description="Personal health intelligence platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(processing.router, prefix=API_PREFIX)
app.include_router(metrics.router, prefix=API_PREFIX)
app.include_router(medications.router, prefix=API_PREFIX)
app.include_router(reminders.router, prefix=API_PREFIX)
app.include_router(assistant.router, prefix=API_PREFIX)
app.include_router(timeline.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(settings_router.router, prefix=API_PREFIX)
app.include_router(feedback.router, prefix=API_PREFIX)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "HealthVault AI"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )
