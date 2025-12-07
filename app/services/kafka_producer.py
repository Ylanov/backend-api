import json
import logging
import asyncio
from aiokafka import AIOKafkaProducer
from app.core.settings import settings

logger = logging.getLogger(__name__)


class KafkaProducerService:
    _producer: AIOKafkaProducer = None

    @classmethod
    async def start(cls):
        """Запуск соединения с механизмом Retry"""
        if not settings.ENABLE_KAFKA:
            logger.info("Kafka producer is disabled (ENABLE_KAFKA=false). Skipping connection.")
            cls._producer = None
            return

        logger.info("Connecting to Kafka...")

        retries = 10  # Пытаться 10 раз
        delay = 5  # Пауза 5 секунд между попытками

        for i in range(retries):
            try:
                cls._producer = AIOKafkaProducer(
                    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                    value_serializer=lambda v: json.dumps(v).encode('utf-8')
                )
                await cls._producer.start()
                logger.info("✅ Kafka Producer successfully connected.")
                return  # Успех, выходим из функции
            except Exception as e:
                logger.warning(f"⚠️ Connection attempt {i + 1}/{retries} failed: {e}")
                if i < retries - 1:
                    await asyncio.sleep(delay)
                else:
                    logger.error("❌ Failed to connect to Kafka after all retries. System will work without events.")
                    cls._producer = None

    @classmethod
    async def stop(cls):
        """Остановка при выключении"""
        if cls._producer:
            await cls._producer.stop()
            logger.info("Kafka Producer disconnected.")

    @classmethod
    async def send_event(cls, topic: str, event_type: str, data: dict):
        """Отправка события"""
        if not cls._producer:
            logger.error("Kafka producer is not initialized. Event skipped.")
            return

        message = {
            "type": event_type,
            "payload": data
        }

        try:
            await cls._producer.send_and_wait(topic, message)
            logger.info(f"Sent event {event_type} to {topic}")
        except Exception as e:
            logger.error(f"Failed to send Kafka event: {e}")