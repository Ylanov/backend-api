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

    # --- НОВЫЕ НАСТРОЙКИ ДЛЯ AI (GigaChat + RAG) ---

    # Ключ авторизации GigaChat (мы передаем его через Secret в k8s или .env локально)
    GIGACHAT_CREDENTIALS: str = Field(..., env="GIGACHAT_CREDENTIALS")

    # Отключение проверки SSL (нужно для GigaChat в некоторых контурах)
    GIGACHAT_VERIFY_SSL: bool = Field(False, env="GIGACHAT_VERIFY_SSL")

    # Область видимости: "GIGACHAT_API_PERS" (для физлиц) или "GIGACHAT_API_CORP" (для бизнеса)
    GIGACHAT_SCOPE: str = Field("GIGACHAT_API_PERS", env="GIGACHAT_SCOPE")

    # Название модели для эмбеддингов (локальная модель HuggingFace)
    # Она скачается сама при первом запуске в /tmp или кэш
    EMBEDDING_MODEL_NAME: str = Field("intfloat/multilingual-e5-large", env="EMBEDDING_MODEL_NAME")
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka-svc:9092" # Имя сервиса из k8s
    KAFKA_TOPIC_TASKS: str = "pyro.tasks.events"

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
        # Позволяет игнорировать лишние переменные в .env файле, чтобы не падало с ошибкой
        extra = "ignore"


settings = Settings()