# tests/test_documents_errors.py
import asyncio
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api import documents as documents_module
from app.models import Document


class DummySessionDocNotFound:
    """DB-сессия, которая всегда возвращает None (документ не найден)."""

    async def get(self, model, pk):
        return None


class DummySessionFileMissing:
    """DB-сессия, которая возвращает документ, но файла на диске нет."""

    def __init__(self, unique_name: str):
        self._unique_name = unique_name

    async def get(self, model, pk):
        return Document(
            id=pk,
            title="Test doc",
            description=None,
            original_name="test.txt",
            unique_name=self._unique_name,
            mime_type="text/plain",
            size=1,
            tags=[],
        )


def test_download_document_document_not_found():
    async def _call():
        db = DummySessionDocNotFound()
        await documents_module.download_document(doc_id=1, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Document not found"


def test_download_document_file_missing_on_disk(tmp_path, monkeypatch):
    # Подменяем UPLOAD_DIR на временную папку без файла
    monkeypatch.setattr(documents_module, "UPLOAD_DIR", Path(tmp_path))

    async def _call():
        db = DummySessionFileMissing(unique_name="missing.txt")
        await documents_module.download_document(doc_id=1, db=db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 404
    assert "file not found on disk" in exc.value.detail.lower()
