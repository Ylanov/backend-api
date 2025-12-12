# app/worker.py
import asyncio
import json
import logging
import os
import sys

# Добавляем корень проекта в sys.path, чтобы видеть пакет app
sys.path.append(os.getcwd())

from aiokafka import AIOKafkaConsumer

from app.core.settings import settings

# Настройка логгера
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [WORKER] - %(levelname)s - %(message)s"
)
logger = logging.getLogger("WORKER")


async def process_task_event(data: dict):
    """
    Обработка события создания задачи (например, отправка уведомлений).
    """
    task_id = data.get("task_id")
    title = data.get("title")
    logger.info(f"🔔 New Task Event received: ID {task_id} - '{title}'. Sending notifications...")

    # Имитация отправки Push/Email
    # В реальности здесь будет вызов Firebase/SMTP
    await asyncio.sleep(0.5)

    logger.info(f"✅ Notifications for Task {task_id} sent.")


async def consume():
    """
    Главный цикл воркера.
    """
    logger.info(f"Starting Kafka Worker (Lite Mode)...")
    logger.info(f"Bootstrap Servers: {settings.KAFKA_BOOTSTRAP_SERVERS}")

    # Подписываемся только на топик задач.
    # Топик документов больше не слушаем, так как обработка RAG теперь на стороне Dify.
    topics = [settings.KAFKA_TOPIC_TASKS]

    consumer = AIOKafkaConsumer(
        *topics,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="pyro_background_workers",
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        auto_offset_reset="earliest"
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

            if topic == settings.KAFKA_TOPIC_TASKS and event_type == "task_created":
                await process_task_event(data)

            # Если появятся другие типы событий (например, system_logs), добавить их сюда

    finally:
        await consumer.stop()


if __name__ == "__main__":
    try:
        asyncio.run(consume())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")