# tests/test_comments_validation.py
import asyncio
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import BackgroundTasks, HTTPException, UploadFile

from app.api import comments as comments_module
from app.models import Task


class DummyTask:
    def __init__(self, task_id: int):
        self.id = task_id
        self.team = None
        self.title = "Dummy task"


class DummySessionForComments:
    """Минимальная заглушка AsyncSession для проверки валидации вложений/текста."""

    async def get(self, model, pk):
        if model is Task:
            return DummyTask(pk)
        return None

    # db.add(comment) вызывается синхронно, поэтому add должен быть обычной функцией
    def add(self, obj):
        return None


class DummyPyro:
    def __init__(self, pyro_id: int):
        self.id = pyro_id
        self.full_name = "Author"


def test_create_task_comment_rejects_disallowed_extension(tmp_path, monkeypatch):
    # Чтобы не писать реальные файлы, подменяем UPLOAD_DIR на временную папку
    monkeypatch.setattr(comments_module, "UPLOAD_DIR", Path(tmp_path))

    # Файл с запрещённым расширением
    bad_file = UploadFile(
        filename="malware.exe",
        file=BytesIO(b"dummy content"),
    )

    db = DummySessionForComments()
    current_pyro = DummyPyro(pyro_id=1)
    background_tasks = BackgroundTasks()

    async def _call():
        await comments_module.create_task_comment(
            task_id=1,
            background_tasks=background_tasks,
            request=None,  # в этой ветке request не используется
            db=db,
            text=None,
            files=[bad_file],
            current_pyro=current_pyro,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    msg = exc.value.detail.lower()
    assert "тип файла" in msg
    assert "не разрешен" in msg


def test_create_task_comment_requires_text_or_files(tmp_path, monkeypatch):
    # Подменяем UPLOAD_DIR (хотя файлов нет, но для единообразия)
    monkeypatch.setattr(comments_module, "UPLOAD_DIR", Path(tmp_path))

    db = DummySessionForComments()
    current_pyro = DummyPyro(pyro_id=1)
    background_tasks = BackgroundTasks()

    async def _call():
        await comments_module.create_task_comment(
            task_id=1,
            background_tasks=background_tasks,
            request=None,
            db=db,
            text=None,
            files=None,
            current_pyro=current_pyro,
        )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())

    assert exc.value.status_code == 400
    assert "comment must have text or attachments" in exc.value.detail.lower()
