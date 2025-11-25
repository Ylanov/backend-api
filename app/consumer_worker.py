import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer
from app.core.settings import settings

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CONSUMER")


async def consume():
    logger.info(f"Starting Kafka Consumer for topic: {settings.KAFKA_TOPIC_TASKS}")

    # Подключаемся к Kafka
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC_TASKS,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="pyro_notification_group",  # Группа консьюмеров (для масштабирования)
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )

    await consumer.start()
    try:
        # Бесконечный цикл чтения сообщений
        async for msg in consumer:
            event = msg.value
            logger.info(f"Received event: {event['type']}")

            if event['type'] == 'task_created':
                task_data = event['payload']
                # ЗДЕСЬ БУДЕТ ЛОГИКА ОТПРАВКИ PUSH-УВЕДОМЛЕНИЯ
                logger.info(f" [>>>] SENDING PUSH NOTIFICATION for Task #{task_data['task_id']} '{task_data['title']}'")
                # await send_firebase_push(...)

    finally:
        await consumer.stop()


if __name__ == "__main__":
    # Запуск асинхронного цикла
    asyncio.run(consume())