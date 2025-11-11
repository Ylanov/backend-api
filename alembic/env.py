# alembic/env.py
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Это импортирует Base из ваших моделей, чтобы Alembic "видел" их
from app.models import Base
from app.database import DATABASE_URL  # Берём URL из единого модуля БД


# Это объект метаданных ваших моделей, Alembic будет сравнивать его с состоянием БД
target_metadata = Base.metadata

# Стандартная конфигурация для логгирования
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---

# Alembic для автогенерации использует синхронный движок, которому не нравится "+asyncpg"
# Мы создаем отдельную переменную для этого, а оригинальный URL не трогаем.
sync_db_url = DATABASE_URL
if sync_db_url and sync_db_url.startswith("postgresql+asyncpg"):
    sync_db_url = sync_db_url.replace("postgresql+asyncpg", "postgresql")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=sync_db_url,  # Используем синхронный URL
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    # Для создания асинхронного движка мы передаем конфигурацию,
    # но в ней должен быть ПРАВИЛЬНЫЙ асинхронный URL.
    # Мы временно подменяем 'sqlalchemy.url' в конфигурации на оригинальный.
    configuration = config.get_section(config.config_ini_section)
    configuration['sqlalchemy.url'] = DATABASE_URL  # Используем оригинальный async URL

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        # Здесь мы запускаем синхронную функцию do_run_migrations
        # внутри асинхронного окружения.
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    # Убираем замену URL из глобальной конфигурации,
    # чтобы она не мешала другим частям Alembic.
    config.set_main_option("sqlalchemy.url", sync_db_url)
    asyncio.run(run_migrations_online())