# 1. Лёгкая база
FROM python:3.12-slim

# 2. Системные зависимости (опционально: tzdata для локали)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. Пинаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Копируем код
COPY app ./app

# 5. Uvicorn старт
# В Kubernetes адрес и порт прокинем из Service, но слушать нужно 0.0.0.0
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
