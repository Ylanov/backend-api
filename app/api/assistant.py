# app/api/assistant.py
from __future__ import annotations
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.security import get_current_pyro
from app.models import Pyrotechnician, Document
from app.services.rag import (
    search_related_chunks,
    generate_answer_stream,
    get_cached_answer,
    set_cached_answer
)

router = APIRouter(prefix="/assistant", tags=["assistant"])


class SourceItem(BaseModel):
    title: str
    doc_id: int
    page: Optional[int] = None


class QueryRequest(BaseModel):
    question: str


@router.post("/ask") # <-- ИЗМЕНЕНИЕ ЗДЕСЬ: /ask_stream -> /ask
async def ask_assistant_stream(
        payload: QueryRequest,
        db: AsyncSession = Depends(get_db),
        current_pyro: Pyrotechnician = Depends(get_current_pyro),
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Empty question")

    # 1. Проверяем кеш (мгновенный ответ)
    cached = await get_cached_answer(question)
    if cached:
        async def fake_stream():
            yield cached

        return StreamingResponse(fake_stream(), media_type="text/event-stream")

    # 2. Поиск
    chunks = await search_related_chunks(db, question, limit=5)

    if not chunks:
        async def empty_stream():
            yield "В базе знаний не найдено подходящей информации."

        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    # 3. Формируем контекст с указанием страниц
    context_parts = []

    doc_ids = list({c.document_id for c in chunks})
    docs_res = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    docs_map = {d.id: d.title for d in docs_res.scalars().all()}

    for c in chunks:
        doc_title = docs_map.get(c.document_id, "Unknown Doc")
        page_str = f" (стр. {c.page_number})" if c.page_number else ""
        context_parts.append(f"Источник: {doc_title}{page_str}\nТекст: {c.content}")

    full_context = "\n\n---\n\n".join(context_parts)

    # 4. Стримим ответ и сохраняем в кеш
    async def response_generator():
        full_answer = ""
        async for text_chunk in generate_answer_stream(full_context, question):
            full_answer += text_chunk
            yield text_chunk

        # Кешируем ответ, если он не пустой
        if len(full_answer) > 20:
            await set_cached_answer(question, full_answer)

    return StreamingResponse(response_generator(), media_type="text/event-stream")