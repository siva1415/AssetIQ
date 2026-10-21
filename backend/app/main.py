from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
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


@app.middleware("http")
async def check_mandatory_password_reset_and_status(request: Request, call_next):
    """
    Global middleware enforcing mandatory first-login password reset and active account status.
    Users with must_reset_password=True are restricted from accessing normal application APIs
    until completing /api/auth/change-password. Stale JWT tokens cannot bypass real-time DB status.
    """
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.strip().lower().startswith("bearer "):
        path = request.url.path.lower()
        exempt_paths = (
            "/api/auth/change-password",
            "/auth/change-password",
            "/api/auth/login",
            "/auth/login",
            "/api/auth/me",
            "/auth/me",
            "/api/me",
            "/api/auth/current-user",
            "/auth/current-user",
            "/api/current-user",
            "/api/auth/last-login",
            "/auth/last-login",
            "/api/last-login",
            "/api/health",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
        )
        if not any(path.startswith(ep) or path == ep for ep in exempt_paths):
            parts = auth_header.strip().split()
            if len(parts) == 2:
                token = parts[1]
                from app.core.security import decode_access_token
                from app.db.session import SessionLocal
                from app.repositories.app_user_repository import AppUserRepository
                from app.api.deps import get_database

                payload = decode_access_token(token)
                if payload:
                    user_id_raw = payload.get("sub") or payload.get("user_id")
                    if user_id_raw:
                        db = None
                        needs_close = False
                        if get_database in app.dependency_overrides:
                            gen = app.dependency_overrides[get_database]()
                            db = next(gen)
                        else:
                            db = SessionLocal()
                            needs_close = True

                        try:
                            user = AppUserRepository.get_by_id(db, int(user_id_raw))
                            if user:
                                if user.status.upper() != "ACTIVE":
                                    return JSONResponse(
                                        status_code=status.HTTP_403_FORBIDDEN,
                                        content={
                                            "detail": "User account is inactive. Please contact your system administrator.",
                                            "status_code": status.HTTP_403_FORBIDDEN,
                                        },
                                    )
                                if user.must_reset_password:
                                    return JSONResponse(
                                        status_code=status.HTTP_403_FORBIDDEN,
                                        content={
                                            "detail": "Password change required before accessing application resources. Please update your password.",
                                            "status_code": status.HTTP_403_FORBIDDEN,
                                        },
                                    )
                        finally:
                            if needs_close and db:
                                db.close()

    response = await call_next(request)
    return response

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
    safe_errors = jsonable_encoder(exc.errors())
    logger.warning(f"Request validation failure on {request.url.path}: {safe_errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request parameter validation failed",
            "errors": safe_errors,
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

# Core REST API endpoints mounted under /api (standard), root, and duplicated prefix safeguard
app.include_router(api_router, prefix="/api")
app.include_router(api_router, include_in_schema=False)
app.include_router(api_router, prefix="/api/api", include_in_schema=False)


@app.get("/", include_in_schema=False)
def root():
    return {
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "docs_url": "/docs",
        "health_check": "/health",
        "version": "1.0.0",
    }
