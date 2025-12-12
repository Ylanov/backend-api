# app/services/dify_knowledge.py
from __future__ import annotations

import json
import logging
from pathlib import Path
import httpx

from app.core.settings import settings

logger = logging.getLogger(__name__)

BASE_URL = settings.DIFY_API_URL.rstrip("/")
DATASET_ID = settings.DIFY_DATASET_ID
DATASET_API_KEY = settings.DIFY_DATASET_API_KEY


async def upload_file_to_dify(file_path: Path, original_name: str) -> str | None:
    """
    Загружает файл в Dify и возвращает dify_document_id.
    """
    if not DATASET_ID or not DATASET_API_KEY:
        logger.error("❌ Dify Dataset config missing. Skipping upload.")
        return None

    url = f"{BASE_URL}/datasets/{DATASET_ID}/document/create_by_file"
    headers = {"Authorization": f"Bearer {DATASET_API_KEY}"}

    process_rule = {
        "indexing_technique": "high_quality",
        "process_rule": {"mode": "automatic"}
    }

    try:
        files = {
            "file": (original_name, open(file_path, "rb"), "application/octet-stream")
        }
        data = {"data": json.dumps(process_rule)}

        logger.info(f"📤 [Dify] Uploading file '{original_name}'...")
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, data=data, files=files)

        files["file"][1].close()

        if response.status_code in [200, 201]:
            resp_data = response.json()
            dify_doc = resp_data.get("document", {})
            dify_id = dify_doc.get("id")
            logger.info(f"✅ [Dify] Uploaded successfully. ID: {dify_id}")
            return dify_id
        else:
            logger.error(f"❌ [Dify] Upload failed: {response.status_code} - {response.text}")
            return None

    except Exception as e:
        logger.exception(f"❌ [Dify] Error uploading file: {e}")
        return None


async def delete_document_from_dify(dify_document_id: str) -> bool:
    """
    Удаляет документ из базы знаний Dify.
    """
    if not DATASET_ID or not DATASET_API_KEY or not dify_document_id:
        return False

    url = f"{BASE_URL}/datasets/{DATASET_ID}/documents/{dify_document_id}"
    headers = {"Authorization": f"Bearer {DATASET_API_KEY}"}

    try:
        logger.info(f"🗑️ [Dify] Deleting document {dify_document_id}...")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(url, headers=headers)

        if response.status_code in [200, 204]:
            logger.info(f"✅ [Dify] Document {dify_document_id} deleted.")
            return True
        else:
            logger.warning(f"⚠️ [Dify] Delete failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ [Dify] Error deleting document: {e}")
        return False