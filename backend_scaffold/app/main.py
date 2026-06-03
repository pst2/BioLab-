from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import genes, pubmed, sequence, system
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import limiter

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ------------------------------------------------------------------ #
    # Startup                                                              #
    # Schema is managed exclusively by Alembic.                           #
    # Run `alembic upgrade head` before starting the server.              #
    # DO NOT call init_db() / create_all() here — that bypasses           #
    # migration history and causes schema drift in production.             #
    # ------------------------------------------------------------------ #
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    logger.info("Database : %s", settings.DATABASE_URL)
    logger.info("API keys : %d configured", len(settings.api_keys_list))
    if settings.DEBUG:
        logger.warning(
            "DEBUG=true — validation errors will include full detail. "
            "Do NOT run with DEBUG=true in production."
        )
    yield
    # ------------------------------------------------------------------ #
    # Shutdown                                                             #
    # ------------------------------------------------------------------ #
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(system.router, prefix=settings.API_V1_PREFIX, tags=["system"])
app.include_router(genes.router, prefix=f"{settings.API_V1_PREFIX}/genes", tags=["genes"])
app.include_router(pubmed.router, prefix=f"{settings.API_V1_PREFIX}/pubmed", tags=["pubmed"])
app.include_router(sequence.router, prefix=f"{settings.API_V1_PREFIX}/sequence", tags=["sequence"])


@app.get("/")
def root() -> dict:
    return {
        "success": True,
        "message": f"{settings.APP_NAME} is running",
        "data": {
            "version": settings.APP_VERSION,
            "docs": "/docs",
        },
    }
