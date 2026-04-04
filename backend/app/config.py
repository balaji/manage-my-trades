"""
Application configuration module.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    # Application
    APP_NAME: str = "Algorithmic ETF Trading"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    TRADE_DATA_DATABASE_URL: str = ""
    MARKET_DATA_DATABASE_URL: str = ""
    CORS_ORIGINS: List[str] = []
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = ""
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4.1-mini"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    SESSION_SECRET_KEY: str = "manage-my-trades-session-secret"
    SESSION_COOKIE_NAME: str = "trade_session"
    GOOGLE_AUTH_BASE_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL: str = "https://openidconnect.googleapis.com/v1/userinfo"
    FRONTEND_CALLBACK_URL: str = "http://localhost:3000/auth/callback"

    # Trading Configuration
    DEFAULT_COMMISSION: float = 0.0  # Alpaca has no commission
    DEFAULT_SLIPPAGE: float = 0.001  # 0.1% slippage

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
