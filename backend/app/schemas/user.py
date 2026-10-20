from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str
    name: str
    email: Optional[str] = None
    role: str
    must_change_password: bool = False
    is_otp: bool = False
    is_root_protected: bool = False
    created_at: Optional[datetime] = None


class LoginResponse(BaseModel):
    authenticated: bool
    token: str
    user: UserProfileResponse
    message: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    username: str
    new_password: str = Field(..., min_length=4)
    current_password: Optional[str] = None


class ActiveSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sessionId: str
    username: str
    name: str
    email: Optional[str] = None
    role: str
    loginTime: Optional[datetime] = None
    lastActive: Optional[datetime] = None
    ipAddress: Optional[str] = None
    userAgent: Optional[str] = None
    status: str
