# app/api/assistant.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.security import get_current_pyro
from app.models import Pyrotechnician, Document
from app.services.rag import search_related_chunks, generate_answer

router = APIRouter(
    prefix="/assistant",
    tags=["assistant"],
)


# --- СХЕМЫ ДЛЯ ОТВЕТА ---

class SourceItem(BaseModel):
    title: str
    doc_id: int


class AssistantResponse(BaseModel):
    answer: str
    sources: List[SourceItem]


class QueryRequest(BaseModel):
    question: str


@router.post("/ask", response_model=AssistantResponse)
async def ask_assistant(
        payload: QueryRequest,
        db: AsyncSession = Depends(get_db),
        # Ассистент доступен только авторизованным пользователям
        current_pyro: Pyrotechnician = Depends(get_current_pyro),
):
    """
    Эндпоинт для RAG:
    1. Ищет релевантные куски документов.
    2. Генерирует ответ через GigaChat.
    """
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Вопрос не может быть пустым")

    # 1. Поиск чанков
    chunks = await search_related_chunks(db, question, limit=5)

    if not chunks:
        return AssistantResponse(
            answer="К сожалению, в базе знаний не найдено подходящей информации для ответа на ваш вопрос.",
            sources=[]
        )

    # 2. Сборка контекста
    # Собираем текст из найденных кусочков
    context_text = "\n\n---\n\n".join([c.content for c in chunks])

    # 3. Получение названий документов (для источников)
    # Чанки содержат document_id. Нам нужно получить названия файлов (Document.title)
    # Чтобы не делать N запросов, соберем ID и сделаем один запрос
    doc_ids = list({c.document_id for c in chunks})  # уникальные ID

    # Запрашиваем документы
    docs_result = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    documents_map = {d.id: d for d in docs_result.scalars().all()}

    sources = []
    for doc_id in doc_ids:
        doc = documents_map.get(doc_id)
        if doc:
            sources.append(SourceItem(title=doc.title or doc.original_name, doc_id=doc.id))

    # 4. Генерация ответа
    answer = await generate_answer(context_text, question)

    return AssistantResponse(
        answer=answer,
        sources=sources
    )