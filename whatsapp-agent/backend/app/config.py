from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7  # 7 days

    token_encryption_key: str

    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5"

    whatsapp_webhook_verify_token: str = "verify-me"
    meta_app_secret: str = ""

    resend_api_key: str = ""
    email_from: str = "WhatsApp Lead Agent <alerts@example.com>"
    support_email: str = "ghk7125@gmail.com"

    cron_secret: str = ""

    frontend_url: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
