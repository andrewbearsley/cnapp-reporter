import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "changeme-generate-a-real-secret-key-at-least-32-chars"
    DATA_DIR: str = os.environ.get("DATA_DIR", "./data")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 480  # 8 hours
    CORS_ORIGINS: list[str] = ["*"]

    @property
    def database_url(self) -> str:
        db_path = Path(self.DATA_DIR) / "app.db"
        return f"sqlite+aiosqlite:///{db_path}"

    @property
    def sync_database_url(self) -> str:
        db_path = Path(self.DATA_DIR) / "app.db"
        return f"sqlite:///{db_path}"

    model_config = {"env_prefix": ""}


settings = Settings()
