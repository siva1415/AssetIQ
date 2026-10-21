from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from app.core.config import settings

# In-memory failed login attempts tracker: identifier -> list of timestamps
_failed_login_attempts: Dict[str, list[datetime]] = {}


def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using bcrypt with a generated salt.
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a bcrypt password hash safely.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Generates a cryptographically signed JWT token with configurable expiration.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"iat": now, "exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates a signed JWT token.
    Returns the payload dictionary or None if expired or invalid.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.PyJWTError:
        return None


def is_rate_limited(identifier: str) -> bool:
    """
    Checks if a username or IP has exceeded maximum failed login attempts within the rate limit window.
    """
    now = datetime.now(timezone.utc)
    window = timedelta(seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS)
    attempts = _failed_login_attempts.get(identifier, [])

    # Filter out attempts older than the window
    valid_attempts = [ts for ts in attempts if now - ts < window]
    _failed_login_attempts[identifier] = valid_attempts

    return len(valid_attempts) >= settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS


def record_failed_login(identifier: str) -> None:
    """
    Records a failed login attempt for rate-limiting.
    """
    now = datetime.now(timezone.utc)
    if identifier not in _failed_login_attempts:
        _failed_login_attempts[identifier] = []
    _failed_login_attempts[identifier].append(now)


def reset_failed_logins(identifier: str) -> None:
    """
    Clears failed login attempts after a successful login.
    """
    if identifier in _failed_login_attempts:
        del _failed_login_attempts[identifier]
