# tests/test_documents_upload_logic.py
import asyncio
import json
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import UploadFile

from app.api import documents as documents_module
from app.models import Document


class DummySessionForUpload:
    """
    Заглушка AsyncSession для проверки успешной загрузки документа.
    Сохраняет добавленный объект, фиксирует вызовы commit и refresh.
    """

    def __init__(self):
        self.added = []
        self.committed = False
        self.refreshed = False

    def add(self, obj):
        # В реальной БД после add/commit у объекта появляется id
        if isinstance(obj, Document):
            obj.id = 1
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        self.refreshed = True


@pytest.fixture
def setup_upload_env(tmp_path, monkeypatch):
    """Фикстура для подмены папки загрузки и лимита размера."""
    monkeypatch.setattr(documents_module, "UPLOAD_DIR", Path(tmp_path))
    monkeypatch.setattr(documents_module, "MAX_FILE_SIZE", 10 * 1024 * 1024) # 10 MB
    return Path(tmp_path)


def test_upload_document_success_with_all_fields(setup_upload_env):
    """
    Проверяет успешный сценарий загрузки со всеми заполненными полями,
    включая корректный JSON-список для тегов.
    """
    tmp_path = setup_upload_env
    db = DummySessionForUpload()

    file_content = b"Simple test file"
    upload_file = UploadFile(
        filename="report.pdf",
        file=BytesIO(file_content),
    )
    tags_json = json.dumps(["report", "year2025", 123]) # теги могут быть разного типа

    # Мок для фоновых задач
    mock_bg_tasks = MagicMock()

    async def _call():
        return await documents_module.upload_document(
            background_tasks=mock_bg_tasks,  # Передаем мок
            db=db,
            file=upload_file,
            title="Annual Report",
            description="Report for the last year.",
            tags=tags_json,
        )

    doc = asyncio.run(_call())

    # 1. Проверяем состояние БД
    assert db.committed is True
    assert db.refreshed is True
    assert len(db.added) == 1
    added_doc = db.added[0]
    assert isinstance(added_doc, Document)

    # 2. Проверяем возвращённый объект и его поля
    assert doc is added_doc
    assert doc.title == "Annual Report"
    assert doc.description == "Report for the last year."
    assert doc.original_name == "report.pdf"
    assert doc.size == len(file_content)
    # Теги должны быть распарсены и приведены к строкам
    assert doc.tags == ["report", "year2025", "123"]

    # 3. Проверяем, что файл физически сохранился
    saved_file_path = tmp_path / doc.unique_name
    assert saved_file_path.exists()
    assert saved_file_path.read_bytes() == file_content


def test_upload_document_defaults_title_and_handles_no_tags(setup_upload_env):
    """
    Проверяет, что если title не передан, он берётся из имени файла,
    а если tags не переданы, список тегов остаётся пустым.
    """
    db = DummySessionForUpload()
    upload_file = UploadFile(filename="data.xlsx", file=BytesIO(b"data"))
    mock_bg_tasks = MagicMock()

    async def _call():
        return await documents_module.upload_document(
            background_tasks=mock_bg_tasks,  # Передаем мок
            db=db,
            file=upload_file,
            title=None,
            description=None,
            tags=None,
        )

    doc = asyncio.run(_call())

    # title должен быть равен имени файла
    assert doc.title == "data.xlsx"
    # тегов нет
    assert doc.tags == []
    assert db.committed is True


@pytest.mark.parametrize(
    "tags_input",
    [
        "this is not json",          # Некорректный JSON
        '{"key": "value"}',         # Корректный JSON, но не список
        '123',                       # Корректный JSON, но не список
    ],
)
def test_upload_document_ignores_invalid_tags_format(setup_upload_env, tags_input):
    """
    Проверяет, что некорректный формат тегов (невалидный JSON или не-список)
    тихо игнорируется, и у документа будет пустой список тегов.
    """
    db = DummySessionForUpload()
    # ИСПРАВЛЕНИЕ: Используем разрешенное расширение .pdf вместо .txt
    upload_file = UploadFile(filename="file.pdf", file=BytesIO(b"text"))
    mock_bg_tasks = MagicMock()

    async def _call():
        return await documents_module.upload_document(
            background_tasks=mock_bg_tasks,  # Передаем мок
            db=db,
            file=upload_file,
            title="File with bad tags",
            description=None,
            tags=tags_input,
        )

    doc = asyncio.run(_call())

    # Ожидаем, что блок try-except отработал и теги остались пустым списком
    assert doc.tags == []
    assert db.committed is True