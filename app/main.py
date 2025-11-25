from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status, APIRouter
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from prometheus_fastapi_instrumentator import Instrumentator

from app.core.settings import settings
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.services.kafka_producer import KafkaProducerService

# --- Импорты всех роутеров ---
from app.api import dashboard as dashboard_api
from app.api import tasks as tasks_api
from app.api import pyrotechnicians as pyros_api
from app.api import teams as teams_api
from app.api import organization as org_api
from app.api import zones as zones_api
from app.api import documents as docs_api
from app.api import auth as auth_api
from app.api import notifications as notifications_api
from app.api import comments as comments_api
from app.api import reports as reports_api
from app.api import logs as logs_api
from app.api import assistant as assistant_api

# Настройка логгера
logger = logging.getLogger(__name__)

# Создаем папку для загрузок, если её нет (критично для StaticFiles)
UPLOAD_DIR = settings.UPLOAD_DIR
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.error(f"Failed to create upload directory {UPLOAD_DIR}: {e}")


# ------------------------------------------------------------
# Жизненный цикл приложения (Lifespan)
# Здесь мы подключаемся к внешним сервисам (Kafka) при старте
# и отключаемся при выключении.
# ------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP (Запуск) ---
    logger.info("Application startup: connecting to services...")
    # Запускаем Kafka Producer (если Kafka недоступна, просто напишет лог, не упадет)
    await KafkaProducerService.start()

    yield

    # --- SHUTDOWN (Остановка) ---
    logger.info("Application shutdown: closing connections...")
    await KafkaProducerService.stop()


# ------------------------------------------------------------
# Приложение
# ------------------------------------------------------------
app = FastAPI(
    title="Pyro API - Swagger UI",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan  # <-- Подключаем логику старта/стопа
)

# --- Middleware ---
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# --- Создаем главный роутер с префиксом /api ---
api_router = APIRouter(prefix="/api")

# --- Подключаем все бизнес-роутеры ---
api_router.include_router(dashboard_api.router)
api_router.include_router(tasks_api.router)
api_router.include_router(pyros_api.router)
api_router.include_router(teams_api.router)
api_router.include_router(org_api.router)
api_router.include_router(zones_api.router)
api_router.include_router(docs_api.router)
api_router.include_router(auth_api.router)
api_router.include_router(notifications_api.router)
api_router.include_router(comments_api.router)
api_router.include_router(reports_api.router)
api_router.include_router(logs_api.router)
api_router.include_router(assistant_api.router)


# --- Системные эндпоинты (Healthcheck) ---
@api_router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


# --- Подключаем главный роутер к приложению ---
app.include_router(api_router)

# --- ВАЖНО: Раздача статических файлов (картинок/документов) ---
# Это позволяет открывать ссылки вида http://domain.com/uploads/file.jpg
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Подключаем Prometheus-метрики ---
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


# --- Глобальные обработчики ошибок ---

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error": {
                "type": "http_exception",
                "message": exc.detail,
                "status_code": exc.status_code,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Перехватывает ошибки валидации Pydantic (например, неверный тип данных)
    и возвращает понятный JSON вместо 500 ошибки.
    """
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "error": {
                "type": "validation_error",
                "message": "Validation error",
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            },
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Ловит все остальные ошибки (падения кода), пишет их в лог и отдает 500.
    """
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error": {
                "type": "internal_error",
                "message": "Internal server error",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        },
    )