# app/core/settings.py
from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- БАЗОВЫЕ НАСТРОЙКИ ПРИЛОЖЕНИЯ ---
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    SECRET_KEY: SecretStr = Field(
        "CHANGE_ME_IN_PRODUCTION",
        env="SECRET_KEY",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        480,
        env="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    UPLOAD_DIR: Path = Field(
        Path("/uploads"),
        env="UPLOAD_DIR",
    )

    # --- CORS-НАСТРОЙКИ ---
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

    # --- НАСТРОЙКИ ВЗАИМОДЕЙСТВИЯ С RAG (Dify) ---
    # Базовый URL сервиса Dify API (например, http://rag.asy-tk.ru/v1)
    DIFY_API_URL: str = Field(
        ...,
        env="DIFY_API_URL",
    )
    # API-ключ приложения / чат-бота в Dify
    DIFY_API_KEY: str = Field(
        ...,
        env="DIFY_API_KEY",
    )
    # ID workflow (если нужен) – можно не использовать при работе через /chat-messages
    DIFY_WORKFLOW_ID: str = Field(
        "",
        env="DIFY_WORKFLOW_ID",
    )
    # Имя поля в ответе Dify, где лежит конечный ответ (для /chat-messages это обычно "answer")
    DIFY_OUTPUT_KEY: str = Field(
        "answer",
        env="DIFY_OUTPUT_KEY",
    )
    # Таймаут запроса к Dify в секундах
    DIFY_TIMEOUT_SECONDS: int = Field(
        60,
        env="DIFY_TIMEOUT_SECONDS",
    )
    # --- Dify Knowledge Base (для загрузки файлов) ---
    # Ключ, который вы скинули (начинается на dataset-)
    DIFY_DATASET_API_KEY: str = Field(..., env="DIFY_DATASET_API_KEY")
    # ID базы знаний (UUID из URL)
    DIFY_DATASET_ID: str = Field(..., env="DIFY_DATASET_ID")

    # --- KAFKA SETTINGS (для событий Pyro) ---
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        "kafka-svc:9092",
        env="KAFKA_BOOTSTRAP_SERVERS",
    )
    KAFKA_TOPIC_TASKS: str = Field(
        "pyro.tasks.events",
        env="KAFKA_TOPIC_TASKS",
    )
    KAFKA_TOPIC_DOCS: str = Field(
        "pyro.documents.events",
        env="KAFKA_TOPIC_DOCS",
    )

    # --- УТИЛИТАРНЫЙ ВАЛИДАТОР ДЛЯ СПИСКОВ ИЗ ENV ---
    @field_validator(
        "BACKEND_CORS_ORIGINS",
        "CORS_ALLOW_METHODS",
        "CORS_ALLOW_HEADERS",
        mode="before",
    )
    @classmethod
    def _split_str_to_list(cls, v):
        """
        Разбираем значения вида:
        - "http://a.com,http://b.com"
        - '["http://a.com", "http://b.com"]'
        в список строк.
        """
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip.startswith("[") and v_strip.endswith("]"):
                try:
                    import json

                    parsed = json.loads(v_strip)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    # если не получилось распарсить JSON — падаем обратно
                    # к разбиению по запятой
                    pass
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
