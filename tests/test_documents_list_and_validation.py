# tests/test_documents_list_and_validation.py
import asyncio
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, UploadFile

from app.api import documents as documents_module
from app.models import Document


# ============================
#   list_documents
# ============================

class DummyScalarsDocs:
    def __init__(self, docs):
        self._docs = docs

    def all(self):
        # имитируем Result.scalars().all()
        return list(self._docs)


class DummyResultDocs:
    def __init__(self, docs):
        self._docs = docs

    def scalars(self):
        return DummyScalarsDocs(self._docs)


class DummySessionListDocs:
    """Заглушка AsyncSession для list_documents."""

    def __init__(self, docs):
        self._docs = docs

    async def execute(self, stmt):
        # stmt мы не анализируем, важно только вернуть объект с .scalars().all()
        return DummyResultDocs(self._docs)


def test_list_documents_returns_ordered_list():
    """Проверяем, что list_documents возвращает список документов из execute()."""
    doc1 = Document(
        id=1,
        title="Doc 1",
        description=None,
        original_name="doc1.pdf",
        unique_name="1.pdf",
        mime_type="application/pdf",
        size=100,
        tags=["tag1"],
    )
    doc2 = Document(
        id=2,
        title="Doc 2",
        description=None,
        original_name="doc2.pdf",
        unique_name="2.pdf",
        mime_type="application/pdf",
        size=200,
        tags=["tag2"],
    )

    db = DummySessionListDocs([doc2, doc1])  # порядок задаём сами

    async def _call():
        return await documents_module.list_documents(db=db)

    docs = asyncio.run(_call())

    assert isinstance(docs, list)
    assert len(docs) == 2
    assert docs[0] is doc2
    assert docs[1] is doc1
    # тем самым покрываем:
    # result = await db.execute(select(...))
    # docs = list(result.scalars().all())


# ============================
#   upload_document: валидация
# ============================

def test_upload_document_no_file():
    """Если файл не передан, должен быть 400 'Файл не передан'."""
    # db здесь не используется (валидация отваливается раньше)
    db = object()
    mock_bg_tasks = MagicMock()

    async def _call():
        await documents_module.upload_document(
            background_tasks=mock_bg_tasks,  # Передаем мок
            db=db,
            file=None,           # ключевой момент
            title=None,
            description=None,
            tags=None,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    assert exc.value.detail == "Файл не передан"


def test_upload_document_invalid_extension():
    """Если расширение файла не из ALLOWED_EXTENSIONS, должен быть 400."""
    db = object()
    mock_bg_tasks = MagicMock()

    upload = UploadFile(
        filename="virus.exe",
        file=BytesIO(b"dummy content"),
    )

    async def _call():
        await documents_module.upload_document(
            background_tasks=mock_bg_tasks,  # Передаем мок
            db=db,
            file=upload,
            title=None,
            description=None,
            tags=None,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    msg = exc.value.detail.lower()
    assert "тип файла" in msg
    assert "не разрешен" in msg


def test_upload_document_too_large(tmp_path, monkeypatch):
    """
    Если размер файла больше MAX_FILE_SIZE, должен быть 413.
    Чтобы не создавать гигантский файл, уменьшаем MAX_FILE_SIZE через monkeypatch.
    """
    # Подменяем лимит на очень маленький
    monkeypatch.setattr(documents_module, "MAX_FILE_SIZE", 10)

    # Подменяем папку загрузки, чтобы ничего не писать в реальную файловую систему
    monkeypatch.setattr(documents_module, "UPLOAD_DIR", Path(tmp_path))

    db = object()
    mock_bg_tasks = MagicMock()

    # Расширение допустимое (.pdf), но размер будет больше MAX_FILE_SIZE
    upload = UploadFile(
        filename="big.pdf",
        file=BytesIO(b"this file is definitely longer than 10 bytes"),
    )

    async def _call():
        await documents_module.upload_document(
            background_tasks=mock_bg_tasks,  # Передаем мок
            db=db,
            file=upload,
            title="Big file",
            description=None,
            tags=None,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 413
    msg = exc.value.detail.lower()
    assert "размер файла" in msg
    assert "превышает" in msg