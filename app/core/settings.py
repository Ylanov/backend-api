# app/core/settings.py
from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # --- DATABASE & SECURITY ---
    DATABASE_URL: str = Field(
        "sqlite+aiosqlite:///./test.db",
        validation_alias="DATABASE_URL",
        description="Fallback to a local SQLite database for tests",
    )
    SECRET_KEY: SecretStr = Field(
        "CHANGE_ME_IN_PRODUCTION",
        validation_alias="SECRET_KEY",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        480,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    UPLOAD_DIR: Path = Field(Path("/uploads"), validation_alias="UPLOAD_DIR")

    # --- CORS-настройки ---
    BACKEND_CORS_ORIGINS: list[str] = Field(
        default=["*"],
        validation_alias="BACKEND_CORS_ORIGINS",
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(
        default=True,
        validation_alias="CORS_ALLOW_CREDENTIALS",
    )
    CORS_ALLOW_METHODS: list[str] = Field(
        default=["*"],
        validation_alias="CORS_ALLOW_METHODS",
    )
    CORS_ALLOW_HEADERS: list[str] = Field(
        default=["*"],
        validation_alias="CORS_ALLOW_HEADERS",
    )

    # --- НАСТРОЙКИ ДЛЯ AI (GigaChat + RAG) ---

    # Ключ авторизации GigaChat
    GIGACHAT_CREDENTIALS: str = Field(
        "test_credentials",
        validation_alias="GIGACHAT_CREDENTIALS",
        description="Dummy credentials to allow local/test startup",
    )

    # Отключение проверки SSL
    GIGACHAT_VERIFY_SSL: bool = Field(False, validation_alias="GIGACHAT_VERIFY_SSL")

    # Область видимости
    GIGACHAT_SCOPE: str = Field("GIGACHAT_API_PERS", validation_alias="GIGACHAT_SCOPE")

    # Название модели для эмбеддингов
    EMBEDDING_MODEL_NAME: str = Field(
        "intfloat/multilingual-e5-large",
        validation_alias="EMBEDDING_MODEL_NAME",
    )

    # --- НОВЫЕ НАСТРОЙКИ (REDIS + RERANKER) ---
    REDIS_URL: str = Field(
        "redis://localhost:6379/0",
        validation_alias="REDIS_URL",
    )
    RERANKER_MODEL_NAME: str = Field(
        "BAAI/bge-reranker-v2-m3",
        validation_alias="RERANKER_MODEL_NAME",
    )

    # --- FEATURE FLAGS ---
    ENABLE_KAFKA: bool = Field(
        False,
        validation_alias="ENABLE_KAFKA",
        description="Disable Kafka integration by default for tests",
    )
    ENABLE_RAG: bool = Field(
        False,
        validation_alias="ENABLE_RAG",
        description="Skip heavy RAG model loading unless explicitly enabled",
    )

    # --- KAFKA SETTINGS ---
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka-svc:9092"
    KAFKA_TOPIC_TASKS: str = "pyro.tasks.events"
    KAFKA_TOPIC_DOCS: str = "pyro.documents.events"

    @field_validator(
        "BACKEND_CORS_ORIGINS",
        "CORS_ALLOW_METHODS",
        "CORS_ALLOW_HEADERS",
        mode="before",
    )
    @classmethod
    def _split_str_to_list(cls, v):
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip.startswith("[") and v_strip.endswith("]"):
                try:
                    import json
                    parsed = json.loads(v_strip)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    pass
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

settings = Settings()