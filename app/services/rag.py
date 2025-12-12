# app/services/rag.py
from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Optional, Any, List

import httpx
from sqlalchemy import select

from app.core.settings import settings
from app.database import SessionLocal
from app.models import Document

logger = logging.getLogger(__name__)

# Получаем настройки из environment
DIFY_API_URL = settings.DIFY_API_URL.rstrip("/")
DIFY_API_KEY = settings.DIFY_API_KEY
# Используем безопасное получение таймаута с дефолтным значением
DIFY_TIMEOUT = getattr(settings, "DIFY_TIMEOUT_SECONDS", 60)


async def generate_answer_stream(
        question: str,
        user_id: str,
        conversation_id: Optional[str] = None,
        files: Optional[List[dict]] = None
) -> AsyncGenerator[str, None]:
    """
    Отправляет запрос в Dify (POST /chat-messages) с response_mode='streaming'.
    Читает SSE-поток от Dify, парсит события и отдает чистый текст ответа.
    В конце стрима собирает источники (Citations) и отправляет их спец. блоком.
    """
    url = f"{DIFY_API_URL}/chat-messages"

    headers = {
        "Authorization": f"Bearer {DIFY_API_KEY}",
        "Content-Type": "application/json",
    }

    # Формируем тело запроса согласно документации Dify API
    payload: dict[str, Any] = {
        "query": question,
        "user": user_id,
        "response_mode": "streaming",  # Включаем режим стриминга
        "inputs": {},  # Сюда можно передавать переменные, если они настроены в Dify App
    }

    if conversation_id:
        payload["conversation_id"] = conversation_id

    if files:
        # Если необходимо передать файлы (картинки для Vision модели)
        payload["files"] = files

    # Список для накопления источников, которые вернет Dify
    collected_sources = []

    # Используем асинхронный клиент с поддержкой стриминга
    async with httpx.AsyncClient(timeout=DIFY_TIMEOUT) as client:
        try:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                # Проверяем статус ответа
                if response.status_code != 200:
                    error_text = await response.aread()
                    logger.error(f"Dify Error {response.status_code}: {error_text.decode()}")
                    yield f"Error from AI core: {response.status_code} - {error_text.decode()}"
                    return

                # Читаем поток построчно
                async for line in response.aiter_lines():
                    if not line or not line.strip():
                        continue

                    # Dify отправляет события в формате SSE, начинающиеся с "data:"
                    if line.startswith("data:"):
                        raw_data = line[5:].strip()  # Убираем префикс "data: "

                        try:
                            data = json.loads(raw_data)
                            event_type = data.get("event")

                            # 1. Обычный текстовый чанк от LLM
                            if event_type == "message":
                                answer_chunk = data.get("answer", "")
                                if answer_chunk:
                                    yield answer_chunk

                            # 2. Конец сообщения (содержит метаданные и источники)
                            elif event_type == "message_end":
                                # Извлекаем retriever_resources (источники)
                                metadata = data.get("metadata", {})
                                retriever_resources = metadata.get("retriever_resources", [])
                                if retriever_resources:
                                    collected_sources = retriever_resources
                                break

                            # 3. Обработка ошибок от Dify внутри стрима
                            elif event_type == "error":
                                error_msg = data.get("message", "Unknown error")
                                logger.error(f"Dify stream error: {data}")
                                yield f"\n[System Error: {error_msg}]"

                            # 4. Пинг (keep-alive)
                            elif event_type == "ping":
                                continue

                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse Dify SSE line: {line}")
                            continue

        except httpx.ConnectError:
            logger.error("Could not connect to Dify API (Connection Error)")
            yield "Service unavailable (connection error)."
        except httpx.TimeoutException:
            logger.error("Dify API request timed out")
            yield "Service unavailable (timeout)."
        except Exception as e:
            logger.exception("Unexpected error in Dify stream")
            yield f"Internal Error: {str(e)}"
            return

    # --- ОБРАБОТКА ИСТОЧНИКОВ (ПОСЛЕ ЗАВЕРШЕНИЯ СТРИМА) ---
    # Если Dify вернул источники, найдем их в нашей БД по dify_document_id,
    # чтобы фронтенд мог сформировать ссылку на скачивание.
    if collected_sources:
        sources_to_send = []

        # Собираем ID документов из Dify (формат Dify: document_id)
        dify_ids = [res.get('document_id') for res in collected_sources if res.get('document_id')]

        if dify_ids:
            try:
                # Ищем соответствия в нашей локальной БД
                async with SessionLocal() as db:
                    stmt = select(Document).where(Document.dify_document_id.in_(dify_ids))
                    result = await db.execute(stmt)
                    local_docs = result.scalars().all()

                    # Создаем мапу: {dify_id -> local_id}
                    local_docs_map = {doc.dify_document_id: doc.id for doc in local_docs}

                    for res in collected_sources:
                        d_id = res.get('document_id')
                        local_id = local_docs_map.get(d_id)

                        sources_to_send.append({
                            "title": res.get('document_name', 'Документ'),
                            "doc_id": local_id,  # Если None, значит файл есть в Dify, но удален у нас
                            "score": res.get('score'),
                            "content": res.get('content')  # Сниппет текста, на который опирался ИИ
                        })
            except Exception as e:
                logger.error(f"Error processing sources: {e}")

        # Если источники сформированы, отправляем их специальным маркером
        if sources_to_send:
            # Маркер __SOURCES__: используется фронтендом для парсинга JSON в конце сообщения
            yield f"\n__SOURCES__:{json.dumps(sources_to_send)}"