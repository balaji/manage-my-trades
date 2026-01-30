"""
Application configuration module.
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings."""

    # Application
    APP_NAME: str = "Algorithmic ETF Trading"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://trading_user:trading_password@localhost:5432/trading_db"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Alpaca API
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"

    # Storage
    MODEL_STORAGE_PATH: str = "/app/storage/models"
    DATA_CACHE_PATH: str = "/app/storage/data"

    # Trading Configuration
    DEFAULT_COMMISSION: float = 0.0  # Alpaca has no commission
    DEFAULT_SLIPPAGE: float = 0.001  # 0.1% slippage

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
