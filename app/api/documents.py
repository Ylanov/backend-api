# app/api/documents.py
from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
# Убираем неиспользуемый Request
# from starlette.requests import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.database import get_db
from app.models import Document
from app.schemas import Document as DocumentOut

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)

# те же ограничения, что и в main.py
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx", ".xls", ".xlsx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

UPLOAD_DIR = settings.UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("", response_model=List[DocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).order_by(Document.uploaded_at.desc()))
    docs = list(result.scalars().all())

    # --- ЭТОТ БЛОК НУЖНО ПОЛНОСТЬЮ УДАЛИТЬ ---
    # base_url = str(request.base_url).rstrip("/")
    # for d in docs:
    #     d.download_url = f"{base_url}/api/documents/{d.id}/download"
    # ---------------------------------------------

    return docs


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    # Убираем неиспользуемый Request
    # request: Request,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Файл не передан")

    # --- валидация расширения ---
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Тип файла {file.filename} не разрешен. "
                f"Разрешенные типы: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    # --- чтение и проверка размера ---
    content = await file.read()
    size = len(content)
    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Размер файла {file.filename} превышает "
                f"{MAX_FILE_SIZE / (1024 * 1024):.0f} MB"
            ),
        )

    # --- парсинг тегов ---
    tag_list: List[str] = []
    if tags:
        try:
            import json

            parsed = json.loads(tags)
            if isinstance(parsed, list):
                tag_list = [str(x) for x in parsed]
        except Exception:
            # некорректный JSON — просто игнорируем
            pass

    # --- сохранение файла ---
    unique_name = f"{uuid.uuid4()}{file_ext}"
    save_path = UPLOAD_DIR / unique_name
    save_path.parent.mkdir(parents=True, exist_ok=True)

    with open(save_path, "wb") as f:
        f.write(content)

    # --- запись в БД ---
    doc = Document(
        title=title or file.filename,
        description=description,
        original_name=file.filename,
        unique_name=unique_name,
        mime_type=file.content_type or "application/octet-stream",
        size=size,
        tags=tag_list,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # --- ЭТИ СТРОКИ НУЖНО УДАЛИТЬ ---
    # base_url = str(request.base_url).rstrip("/")
    # doc.download_url = f"{base_url}/api/documents/{doc.id}/download"
    # -----------------------------------

    return doc


# Эндпоинт для скачивания можно оставить, он может быть полезен,
# но фронтенд его больше не использует для отображения списка
@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = UPLOAD_DIR / doc.unique_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=doc.original_name,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = UPLOAD_DIR / doc.unique_name
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            # В логах будет более информативное сообщение
            print(f"ERROR: could not delete file {file_path}: {e}")

    await db.delete(doc)
    await db.commit()
    return None