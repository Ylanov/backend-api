# --------------------------------------------------------------------
# ЭТАП 1: Сборщик (Builder)
# Здесь мы компилируем библиотеки и скачиваем зависимости
# --------------------------------------------------------------------
FROM python:3.12-slim as builder

WORKDIR /app

# Переменные для Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Устанавливаем системные пакеты, нужные ТОЛЬКО для сборки (компиляторы)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Создаем виртуальное окружение (чтобы потом легко скопировать его целиком)
RUN python -m venv /opt/venv
# Активируем его для следующих команд
ENV PATH="/opt/venv/bin:$PATH"

# !!! САМЫЙ ВАЖНЫЙ ШАГ !!!
# Сначала явно устанавливаем PyTorch для CPU.
# Если этого не сделать, requirements.txt скачает тяжелую версию с CUDA (для видеокарт).
# Это экономит ~3-4 ГБ места.
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Теперь устанавливаем остальные зависимости из файла
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --------------------------------------------------------------------
# ЭТАП 2: Финальный образ (Runtime)
# Легкий образ, куда копируем только готовый результат
# --------------------------------------------------------------------
FROM python:3.12-slim

WORKDIR /app

# Устанавливаем только то, что нужно для ЗАПУСКА
# libpq5 - нужна для работы с Postgres (psycopg2/asyncpg)
# curl - нужен для Healthcheck в Kubernetes
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем подготовленное виртуальное окружение из этапа builder
COPY --from=builder /opt/venv /opt/venv

# Добавляем venv в PATH, чтобы python и uvicorn вызывались из него
ENV PATH="/opt/venv/bin:$PATH"

# Копируем весь код проекта
COPY . .

# Настройки запуска
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]