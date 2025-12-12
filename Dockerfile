# --------------------------------------------------------------------
# ЭТАП 1: Сборщик (Builder)
# --------------------------------------------------------------------
FROM python:3.12-slim as builder

WORKDIR /app

# Переменные для Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Устанавливаем системные пакеты для сборки (компиляторы + библиотеки для Postgres)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Создаем виртуальное окружение
RUN python -m venv /opt/venv
# Активируем его
ENV PATH="/opt/venv/bin:$PATH"

# Устанавливаем зависимости
# PyTorch УБРАН, так как мы используем внешний RAG (Dify)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --------------------------------------------------------------------
# ЭТАП 2: Финальный образ (Runtime)
# --------------------------------------------------------------------
FROM python:3.12-slim

WORKDIR /app

# Устанавливаем runtime-библиотеки
# libpq5 - для Postgres
# curl - для Healthcheck в Kubernetes
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем подготовленное виртуальное окружение из этапа builder
COPY --from=builder /opt/venv /opt/venv

# Добавляем venv в PATH
ENV PATH="/opt/venv/bin:$PATH"

# Копируем код проекта
COPY . .

# Создаем папку для загрузок, чтобы избежать ошибок прав доступа
RUN mkdir -p /uploads

# Настройки запуска
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000

EXPOSE 8000

# Запускаем миграции БД, а затем само приложение
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]