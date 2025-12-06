# app/worker.py
import asyncio
import json
import logging
import os
import sys

# Добавляем корень проекта в sys.path, чтобы видеть пакет app
sys.path.append(os.getcwd())

from aiokafka import AIOKafkaConsumer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.database import SessionLocal
from app.services.rag import process_document

# Настройка логгера
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [WORKER] - %(levelname)s - %(message)s"
)
logger = logging.getLogger("WORKER")


async def process_document_event(data: dict):
    """
    Обработка события загрузки документа.
    """
    doc_id = data.get("doc_id")
    file_path = data.get("file_path")

    if not doc_id or not file_path:
        logger.error("Invalid document event data")
        return

    logger.info(f"🚀 Starting RAG processing for Document ID {doc_id}...")

    # Создаем отдельную сессию БД для этого воркера
    async with SessionLocal() as db:
        try:
            # Вызываем ту самую тяжелую функцию из rag.py
            await process_document(db, file_path, doc_id)
            logger.info(f"✅ Document {doc_id} processed successfully.")
        except Exception as e:
            logger.error(f"❌ Error processing document {doc_id}: {e}")


async def process_task_event(data: dict):
    """
    Обработка события создания задачи (например, отправка уведомлений).
    """
    task_id = data.get("task_id")
    title = data.get("title")
    logger.info(f"🔔 New Task Event received: ID {task_id} - '{title}'. Sending notifications...")
    # Тут была бы логика отправки Push/Email
    await asyncio.sleep(0.5)  # Имитация работы
    logger.info(f"✅ Notifications for Task {task_id} sent.")


async def consume():
    """
    Главный цикл воркера.
    """
    logger.info(f"Starting Kafka Worker...")
    logger.info(f"Bootstrap Servers: {settings.KAFKA_BOOTSTRAP_SERVERS}")

    # Подписываемся сразу на несколько топиков
    topics = [settings.KAFKA_TOPIC_DOCS, settings.KAFKA_TOPIC_TASKS]

    consumer = AIOKafkaConsumer(
        *topics,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="pyro_background_workers",  # Группа гарантирует, что сообщение обработает только 1 воркер
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        auto_offset_reset="earliest"  # Если воркер упал, читать недочитанное
    )

    while True:
        try:
            await consumer.start()
            logger.info("✅ Connected to Kafka!")
            break
        except Exception as e:
            logger.warning(f"⚠️ Kafka not ready, retrying in 5s... ({e})")
            await asyncio.sleep(5)

    try:
        async for msg in consumer:
            topic = msg.topic
            event = msg.value
            event_type = event.get("type")
            data = event.get("payload")

            logger.info(f"📥 Received [{topic}] -> {event_type}")

            # Маршрутизация событий
            if topic == settings.KAFKA_TOPIC_DOCS and event_type == "document_uploaded":
                await process_document_event(data)

            elif topic == settings.KAFKA_TOPIC_TASKS and event_type == "task_created":
                await process_task_event(data)

    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(consume())