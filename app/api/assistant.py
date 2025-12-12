# app/api/assistant.py
from __future__ import annotations

from typing import Optional, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models import Pyrotechnician
from app.security import get_current_pyro
from app.services.rag import generate_answer_stream

router = APIRouter(
    prefix="/assistant",
    tags=["assistant"],
)


class QueryRequest(BaseModel):
    """
    Запрос от фронта к ассистенту.
    """
    question: str
    conversation_id: Optional[str] = None


@router.post("/ask")
async def ask_assistant_stream(
    payload: QueryRequest,
    current_pyro: Pyrotechnician = Depends(get_current_pyro),
):
    """
    Эндпоинт для общения фронта с ИИ через Dify.

    Логика:
    1. Принимаем вопрос от авторизованного пользователя.
    2. Открываем стриминговое соединение с Dify через app.services.rag.
    3. Транслируем (проксируем) полученные чанки текста обратно на фронт в реальном времени.
    """
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Вопрос не может быть пустым.")

    user_id = str(current_pyro.id)
    conversation_id = payload.conversation_id

    async def event_stream() -> AsyncIterator[str]:
        # generate_answer_stream теперь реально читает SSE поток от Dify
        # и возвращает только текст ответа по мере его генерации.
        async for chunk in generate_answer_stream(
            question=question,
            user_id=user_id,
            conversation_id=conversation_id,
        ):
            # ВАЖНО: Оборачиваем чанк в формат SSE (Server-Sent Events).
            # Фронтенд ожидает строку, начинающуюся с "data: "
            # JSON.dumps используется для безопасного экранирования переносов строк внутри чанка
            import json
            yield f"data: {chunk}\n\n"

    # ВАЖНО: Заголовки, чтобы Nginx Proxy Manager НЕ буферизировал ответ,
    # а отдавал его сразу по мере поступления.
    headers = {
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
    }

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=headers
    )