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

    # --- НАСТРОЙКИ ДЛЯ AI (GigaChat + RAG) ---

    # Ключ авторизации GigaChat
    GIGACHAT_CREDENTIALS: str = Field(..., env="GIGACHAT_CREDENTIALS")

    # Отключение проверки SSL
    GIGACHAT_VERIFY_SSL: bool = Field(False, env="GIGACHAT_VERIFY_SSL")

    # Область видимости
    GIGACHAT_SCOPE: str = Field("GIGACHAT_API_PERS", env="GIGACHAT_SCOPE")

    # Название модели для эмбеддингов
    EMBEDDING_MODEL_NAME: str = Field("intfloat/multilingual-e5-large", env="EMBEDDING_MODEL_NAME")

    # --- НОВЫЕ НАСТРОЙКИ (REDIS + RERANKER) ---
    REDIS_URL: str = Field("redis://localhost:6379/0", env="REDIS_URL")
    RERANKER_MODEL_NAME: str = Field("BAAI/bge-reranker-v2-m3", env="RERANKER_MODEL_NAME")

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

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()