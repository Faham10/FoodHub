import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    FRONTEND_URL: str = "http://localhost:5173"
    INITIALIZE_CATALOG_ON_STARTUP: bool = False
    BRANCH1_ADMIN_EMAIL: str | None = None
    BRANCH1_ADMIN_PASSWORD: str | None = None
    BRANCH2_ADMIN_EMAIL: str | None = None
    BRANCH2_ADMIN_PASSWORD: str | None = None

    model_config = SettingsConfigDict(
        env_file=(
            None
            if os.environ.get("FOODHUB_DISABLE_DOTENV") == "1"
            else Path(__file__).resolve().parents[1] / ".env"
        ),
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
