# tests/test_documents_success.py
import asyncio
from pathlib import Path

from fastapi.responses import FileResponse

from app.api import documents as documents_module
from app.models import Document


class DummySessionDocSuccess:
    """Заглушка AsyncSession для успешных сценариев работы с документом."""

    def __init__(self, doc: Document):
        self._doc = doc
        self.deleted = False
        self.committed = False

    async def get(self, model, pk):
        return self._doc

    async def delete(self, obj):
        self.deleted = True

    async def commit(self):
        self.committed = True


def _make_test_document(unique_name: str, original_name: str, size: int = 5) -> Document:
    return Document(
        id=1,
        title="Test doc",
        description=None,
        original_name=original_name,
        unique_name=unique_name,
        mime_type="text/plain",
        size=size,
        tags=[],
    )


def test_download_document_success(tmp_path, monkeypatch):
    # файл физически существует
    unique_name = "file.txt"
    file_path = Path(tmp_path) / unique_name
    file_path.write_bytes(b"hello")

    monkeypatch.setattr(documents_module, "UPLOAD_DIR", Path(tmp_path))

    doc = _make_test_document(unique_name=unique_name, original_name="file.txt")
    db = DummySessionDocSuccess(doc)

    async def _call():
        return await documents_module.download_document(doc_id=1, db=db)

    response = asyncio.run(_call())

    assert isinstance(response, FileResponse)


def test_delete_document_removes_file_and_commits(tmp_path, monkeypatch):
    unique_name = "file_to_delete.txt"
    file_path = Path(tmp_path) / unique_name
    file_path.write_bytes(b"delete me")

    monkeypatch.setattr(documents_module, "UPLOAD_DIR", Path(tmp_path))

    doc = _make_test_document(unique_name=unique_name, original_name="file_to_delete.txt")
    db = DummySessionDocSuccess(doc)

    async def _call():
        await documents_module.delete_document(doc_id=1, db=db)

    asyncio.run(_call())

    # файл удалён
    assert not file_path.exists()
    # и транзакция проведена
    assert db.deleted is True
    assert db.committed is True
