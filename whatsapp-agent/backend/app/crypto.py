"""Encrypt WhatsApp access tokens / app secrets at rest.

Symmetric (Fernet) rather than a full KMS integration — appropriate for a v1
where TOKEN_ENCRYPTION_KEY lives in Vercel's encrypted env store. Swap for a
managed secrets service (AWS Secrets Manager, etc.) referenced by an
access_token_ref column, as the system design's §12 recommends, once volume
justifies it.
"""

from cryptography.fernet import Fernet

from app.config import get_settings


def _fernet() -> Fernet:
    return Fernet(get_settings().token_encryption_key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()
