# app/core/settings.py
from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    SECRET_KEY: SecretStr = Field("CHANGE_ME_IN_PRODUCTION", env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        480,
        env="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    UPLOAD_DIR: Path = Field(Path("/uploads"), env="UPLOAD_DIR")

    # --- CORS-настройки ---
    # Можно передавать либо JSON-список, либо строку через запятую:
    # BACKEND_CORS_ORIGINS=http://localhost:5173,https://my-frontend.com
    BACKEND_CORS_ORIGINS: list[str] = Field(
        default=["*"],
        env="BACKEND_CORS_ORIGINS",
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(
        default=True,
        env="CORS_ALLOW_CREDENTIALS",
    )
    CORS_ALLOW_METHODS: list[str] = Field(
        default=["*"],
        env="CORS_ALLOW_METHODS",
    )
    CORS_ALLOW_HEADERS: list[str] = Field(
        default=["*"],
        env="CORS_ALLOW_HEADERS",
    )

    @field_validator(
        "BACKEND_CORS_ORIGINS",
        "CORS_ALLOW_METHODS",
        "CORS_ALLOW_HEADERS",
        mode="before",
    )
    @classmethod
    def _split_str_to_list(cls, v):
        """
        Позволяет задавать списки как:
        BACKEND_CORS_ORIGINS=http://localhost:5173,https://my-frontend.com
        или как JSON: '["http://localhost:5173","https://my-frontend.com"]'
        """
        if isinstance(v, str):
            # если это JSON-строка списка — попробуем распарсить
            v_strip = v.strip()
            if v_strip.startswith("[") and v_strip.endswith("]"):
                try:
                    import json

                    parsed = json.loads(v_strip)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    # если JSON не удался — падаем в split ниже
                    pass
            # обычная строка через запятую
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
