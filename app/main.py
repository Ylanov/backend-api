# app/main.py
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status, APIRouter
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.settings import settings
from app.middleware.security_headers import SecurityHeadersMiddleware

# --- Импорты всех роутеров ---
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

UPLOAD_DIR = settings.UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
logger = logging.getLogger(__name__)


# ------------------------------------------------------------
# Приложение
# ------------------------------------------------------------
# --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
# Явно указываем пути для документации с префиксом /api
app = FastAPI(
    title="Pyro API - Swagger UI",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)
# --- КОНЕЦ ИЗМЕНЕНИЯ ---


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

# --- Подключаем все роутеры к api_router ---
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


# --- Системные эндпоинты (теперь тоже часть api_router) ---
@api_router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


# --- Подключаем главный роутер к приложению ---
app.include_router(api_router)


# --- Статические файлы (остаются в корне) ---
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# --- Глобальные обработчики ошибок (без изменений) ---
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "error": {"type": "http_exception", "message": exc.detail, "status_code": exc.status_code}})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": exc.errors(), "error": {"type": "validation_error", "message": "Validation error", "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY}})

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Internal server error", "error": {"type": "internal_error", "message": "Internal server error", "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR}})

@app.on_event("startup")
async def on_startup() -> None:
    pass