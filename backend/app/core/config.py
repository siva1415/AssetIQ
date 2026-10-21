import urllib.parse
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    AssetIQ Application Configuration loaded from environment variables.
    """
    APP_NAME: str = "AssetIQ"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Database configuration
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 5432
    DB_NAME: str = "assetiq_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""

    # Optional direct database URL override (e.g. for testing with sqlite)
    DATABASE_URL: str | None = None

    # CORS settings: comma-separated list or JSON array
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173"

    # Governance & EOL Thresholds
    EOL_WARNING_DAYS: int = 90

    # Authentication & Security
    JWT_SECRET_KEY: str = "assetiq-super-secret-jwt-signing-key-production-change"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DEFAULT_TEMPORARY_PASSWORD: str = "test@123"
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300

    # Pagination Defaults
    DEFAULT_PAGE_SIZE: int = 25
    MAX_PAGE_SIZE: int = 100

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def sqlalchemy_database_uri(self) -> str:
        """
        Safely construct PostgreSQL connection string with URL-encoded credentials.
        Uses the modern SQLAlchemy 2.0 + psycopg3 driver format.
        """
        if self.DATABASE_URL:
            return self.DATABASE_URL

        encoded_user = urllib.parse.quote_plus(self.DB_USER)
        encoded_password = urllib.parse.quote_plus(self.DB_PASSWORD)
        return (
            f"postgresql+psycopg://{encoded_user}:{encoded_password}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()
