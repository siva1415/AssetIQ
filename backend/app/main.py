from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.router import api_router
from app.api.v1.endpoints import health
from app.core.config import settings
from app.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifecycle management.
    """
    logger.info(f"Starting {settings.APP_NAME} in '{settings.APP_ENV}' mode (DEBUG={settings.DEBUG})")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=f"{settings.APP_NAME} — Asset Ownership Intelligence & Governance",
    description=(
        "Production-grade REST API backend for enterprise hardware lifecycle management, "
        "Workday employee correlation, and automated discovery governance (BigFix / Jamf).\n\n"
        "**Notice**: This initial release is configured for development. "
        "Authentication and role-based access control (RBAC) should be layered prior to production deployment."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS using settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global Exception Handlers (Security & Clean Responses)
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Consistent envelope for application HTTP exceptions.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Validation error handler providing concise parameter error details.
    """
    logger.warning(f"Request validation failure on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request parameter validation failed",
            "errors": exc.errors(),
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Database error handler: logs the internal error safely while masking
    all SQL statements, stack traces, and database internals from the client.
    """
    logger.error(f"Database error executing {request.method} {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal database error occurred. Please contact your system administrator.",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler to protect against leaking stack traces.
    """
    logger.exception(f"Unhandled server error on {request.method} {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected server error occurred.",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
        },
    )


# ---------------------------------------------------------------------------
# Router Inclusions
# ---------------------------------------------------------------------------

# Health check available directly at /health and /api/health
app.include_router(health.router)
app.include_router(health.router, prefix="/api")

# Core REST API endpoints mounted under /api
app.include_router(api_router, prefix="/api")


@app.get("/", include_in_schema=False)
def root():
    return {
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "docs_url": "/docs",
        "health_check": "/health",
        "version": "1.0.0",
    }
