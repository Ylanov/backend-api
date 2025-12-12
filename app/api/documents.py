# app/api/documents.py
from __future__ import annotations

import uuid
import json
from pathlib import Path
from typing import List, Optional

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.database import get_db, SessionLocal  # <-- Импортируем SessionLocal для фоновых задач
from app.models import Document
from app.schemas import Document as DocumentOut
from app.services.dify_knowledge import upload_file_to_dify, delete_document_from_dify

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".pdf",
    ".doc", ".docx", ".xls", ".xlsx", ".txt", ".md"
}
RAG_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".html"}

MAX_FILE_SIZE = 100 * 1024 * 1024
UPLOAD_DIR = settings.UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# --- ФОНОВАЯ ЗАДАЧА С ОБНОВЛЕНИЕМ БД ---
async def bg_upload_and_save_id(local_doc_id: int, file_path: Path, original_name: str):
    """
    Загружает файл в Dify и сохраняет полученный dify_id в нашу БД.
    """
    dify_id = await upload_file_to_dify(file_path, original_name)

    if dify_id:
        async with SessionLocal() as db:
            doc = await db.get(Document, local_doc_id)
            if doc:
                doc.dify_document_id = dify_id
                await db.commit()
                print(f"DEBUG: Saved Dify ID {dify_id} for Doc {local_doc_id}")


@router.get("", response_model=List[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.uploaded_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
        background_tasks: BackgroundTasks,
        db: AsyncSession = Depends(get_db),
        file: UploadFile = File(...),
        title: Optional[str] = Form(None),
        description: Optional[str] = Form(None),
        tags: Optional[str] = Form(None),
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Файл не передан")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Тип файла не разрешен")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл слишком большой")

    tag_list: List[str] = []
    if tags:
        try:
            parsed = json.loads(tags)
            if isinstance(parsed, list):
                tag_list = [str(x) for x in parsed]
        except Exception:
            pass

    unique_name = f"{uuid.uuid4()}{file_ext}"
    save_path = UPLOAD_DIR / unique_name

    async with aiofiles.open(save_path, "wb") as f:
        await f.write(content)

    doc = Document(
        title=title or file.filename,
        description=description,
        original_name=file.filename,
        unique_name=unique_name,
        mime_type=file.content_type or "application/octet-stream",
        size=len(content),
        tags=tag_list,
    )

    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # --- ОТПРАВКА В DIFY (ФОН) ---
    if file_ext in RAG_EXTENSIONS:
        background_tasks.add_task(
            bg_upload_and_save_id,  # Вызываем обертку
            local_doc_id=doc.id,
            file_path=save_path,
            original_name=doc.original_name
        )
    # -----------------------------

    return doc


@router.get("/{doc_id}/download")
async def download_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    file_path = UPLOAD_DIR / doc.unique_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(path=file_path, filename=doc.original_name, media_type=doc.mime_type)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
        doc_id: int,
        background_tasks: BackgroundTasks,  # Добавляем для удаления из Dify
        db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Удаляем с диска
    file_path = UPLOAD_DIR / doc.unique_name
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass

    # --- УДАЛЕНИЕ ИЗ DIFY ---
    if doc.dify_document_id:
        # Удаляем асинхронно в фоне, чтобы не тормозить интерфейс
        background_tasks.add_task(delete_document_from_dify, doc.dify_document_id)
    # ------------------------

    await db.delete(doc)
    await db.commit()
    return None