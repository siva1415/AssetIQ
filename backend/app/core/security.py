"""
Password hashing helpers for console users.

Hashes use the same PBKDF2-HMAC-SHA256 format as EmployeeService._hash_password
(`pbkdf2_sha256$<iterations>$<hex>`), so accounts created or reset from User
Management can log in through /auth/login and vice versa.
"""

import hashlib
import hmac

_SALT = "workforceiq_salt_2026"
_ITERATIONS = 100000
_SCHEME = "pbkdf2_sha256"


def _derive(raw_password: str, iterations: int) -> str:
    key = hashlib.pbkdf2_hmac(
        "sha256", raw_password.encode("utf-8"), _SALT.encode("utf-8"), iterations
    )
    return key.hex()


def get_password_hash(raw_password: str) -> str:
    return f"{_SCHEME}${_ITERATIONS}${_derive(raw_password, _ITERATIONS)}"


def verify_password(raw_password: str, stored_hash: str) -> bool:
    if not raw_password or not stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) == 3 and parts[0] == _SCHEME:
        try:
            iterations = int(parts[1])
        except ValueError:
            return False
        return hmac.compare_digest(_derive(raw_password, iterations), parts[2])
    return False
