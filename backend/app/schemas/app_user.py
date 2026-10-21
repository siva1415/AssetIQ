from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRole(str, Enum):
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    VIEWER = "VIEWER"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


ROLE_MENU_PERMISSIONS: dict[str, list[str]] = {
    "SUPERADMIN": [
        "Dashboard",
        "Hardware Inventory",
        "Ownership Management",
        "Reports",
        "User Management",
        "Job Scheduler",
        "Audit Logs",
        "Settings",
    ],
    "ADMIN": [
        "Dashboard",
        "Hardware Inventory",
        "Ownership Management",
        "Reports",
        "User Management",
    ],
    "VIEWER": [
        "Dashboard",
        "Hardware Inventory",
        "Reports",
    ],
}


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username for authentication")
    password: str = Field(..., min_length=1, description="Plaintext password")

    model_config = ConfigDict(populate_by_name=True)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    id: int
    username: str
    full_name: str
    email: str
    role: str
    status: str
    must_reset_password: bool
    last_login_at: Optional[datetime] = None
    permissions: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("last_login_at", mode="after")
    @classmethod
    def ensure_timezone_aware(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        ...,
        alias="currentPassword",
        min_length=1,
        description="Current plaintext password"
    )
    new_password: str = Field(
        ...,
        alias="newPassword",
        min_length=8,
        description="New password (minimum 8 characters)"
    )

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 8:
            raise ValueError("Password must be at least 8 characters in length")
        return clean


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100, description="Unique username")
    full_name: str = Field(..., min_length=1, max_length=150, alias="fullName")
    email: str = Field(..., min_length=3, max_length=255)
    role: str = Field(..., description="Role: SUPERADMIN, ADMIN, or VIEWER")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Username cannot be empty or blank")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if "@" not in clean or "." not in clean:
            raise ValueError("A valid email address is required")
        return clean

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        clean = v.strip().upper()
        if clean not in ("SUPERADMIN", "ADMIN", "VIEWER"):
            raise ValueError("Role must be one of: 'SUPERADMIN', 'ADMIN', 'VIEWER'")
        return clean


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, alias="fullName")
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower()
            if "@" not in clean or "." not in clean:
                raise ValueError("A valid email address is required")
            return clean
        return None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().upper()
            if clean not in ("SUPERADMIN", "ADMIN", "VIEWER"):
                raise ValueError("Role must be one of: 'SUPERADMIN', 'ADMIN', 'VIEWER'")
            return clean
        return None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().upper()
            if clean not in ("ACTIVE", "INACTIVE"):
                raise ValueError("Status must be one of: 'ACTIVE', 'INACTIVE'")
            return clean
        return None


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Status: ACTIVE or INACTIVE")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        clean = v.strip().upper()
        if clean not in ("ACTIVE", "INACTIVE"):
            raise ValueError("Status must be one of: 'ACTIVE', 'INACTIVE'")
        return clean


class UserResponse(BaseModel):
    user_id: int
    id: int
    username: str
    full_name: str
    email: str
    role: str
    status: str
    must_reset_password: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    permissions: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("last_login_at", mode="after")
    @classmethod
    def ensure_timezone_aware(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class ResetPasswordResponse(BaseModel):
    message: str
    user_id: int
    username: str
    must_reset_password: bool = True
