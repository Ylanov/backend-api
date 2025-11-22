# app/services/rag.py
import logging
import os
from typing import List

# Библиотеки для AI и RAG
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_gigachat.chat_models import GigaChat
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_huggingface import HuggingFaceEmbeddings

# Работа с БД
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.models import DocumentChunk

logger = logging.getLogger(__name__)

# --- ИНИЦИАЛИЗАЦИЯ МОДЕЛЕЙ ---

# 1. Локальная модель для векторов (HuggingFace)
logger.info("Loading embedding model...")
embeddings_model = HuggingFaceEmbeddings(
    model_name=settings.EMBEDDING_MODEL_NAME,
    # encode_kwargs={'normalize_embeddings': True} # E5 уже нормализует, но можно оставить true
)
logger.info("Embedding model loaded.")

# 2. Клиент GigaChat
chat = GigaChat(
    credentials=settings.GIGACHAT_CREDENTIALS,
    verify_ssl_certs=settings.GIGACHAT_VERIFY_SSL,
    scope=settings.GIGACHAT_SCOPE,
    model="GigaChat",
    temperature=0.1,  # Минимум фантазии, максимум фактов
)


# --- ФУНКЦИИ ---

def get_embedding_sync(text: str) -> List[float]:
    """
    Синхронная генерация вектора.
    """
    return embeddings_model.embed_query(text)


async def process_document(db: AsyncSession, file_path: str, doc_id: int) -> None:
    """
    Основная функция индексации.
    """
    logger.info(f"Started RAG processing for doc_id={doc_id} path={file_path}")

    try:
        # 1. Загрузка текста
        if str(file_path).lower().endswith(".pdf"):
            loader = PyPDFLoader(str(file_path))
        else:
            loader = Docx2txtLoader(str(file_path))

        raw_docs = loader.load()

        # --- ПРОВЕРКА НА ПУСТОЙ ФАЙЛ (ИЛИ СКАН) ---
        if not raw_docs:
            logger.warning(f"Document {doc_id} is empty or could not be parsed.")
            return

        # Логируем начало текста, чтобы убедиться, что это не пустой скан
        preview_text = raw_docs[0].page_content[:500].replace('\n', ' ')
        logger.info(f"DEBUG PDF CONTENT (First 500 chars): {preview_text}")

        if not preview_text.strip():
            logger.error(f"Document {doc_id} seems to have empty text. It might be a scanned image.")
        # ------------------------------------------

        # 2. Нарезка на чанки
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        chunks = text_splitter.split_documents(raw_docs)

        logger.info(f"Document {doc_id} split into {len(chunks)} chunks. Generating embeddings...")

        # 3. Генерация векторов и сохранение
        new_chunks = []
        for i, chunk in enumerate(chunks):
            text_content = chunk.page_content
            clean_text = text_content.replace("\x00", "")

            if not clean_text.strip():
                continue

            # Генерируем вектор
            # Примечание: Для E5 при индексации обычно префикс не нужен (или 'passage: '),
            # но langchain-huggingface делает это стандартно.
            vector = get_embedding_sync(clean_text)

            db_chunk = DocumentChunk(
                document_id=doc_id,
                chunk_index=i,
                content=clean_text,
                embedding=vector
            )
            new_chunks.append(db_chunk)

        if new_chunks:
            db.add_all(new_chunks)
            await db.commit()

        logger.info(f"Document {doc_id} successfully indexed with {len(new_chunks)} vectors.")

    except Exception as e:
        logger.exception(f"Error processing document {doc_id}: {e}")


async def search_related_chunks(db: AsyncSession, query: str, limit: int = 5) -> List[DocumentChunk]:
    """
    Поиск похожих фрагментов в базе данных.
    """
    # --- ВАЖНО ДЛЯ E5 MODEL ---
    # Модель E5 требует префикс "query: " для поисковых запросов,
    # чтобы различать вопросы и ответы в векторном пространстве.
    search_query = f"query: {query}"

    query_vector = get_embedding_sync(search_query)

    stmt = select(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_vector)
    ).limit(limit)

    result = await db.execute(stmt)
    chunks = list(result.scalars().all())

    # --- ЛОГИРОВАНИЕ РЕЗУЛЬТАТОВ ПОИСКА ---
    logger.info(f"RAG Search for '{query}' found {len(chunks)} chunks.")
    for idx, c in enumerate(chunks):
        # Логируем первые 100 символов найденного куска
        logger.info(f"Found Chunk #{idx} (Doc {c.document_id}): {c.content[:100]}...")
    # --------------------------------------

    return chunks


async def generate_answer(context: str, question: str) -> str:
    """
    Отправка запроса в GigaChat с контекстом.
    """
    system_prompt = (
        "Ты — профессиональный помощник сотрудника МЧС. "
        "Твоя задача — отвечать на вопросы, строго основываясь на предоставленном контексте "
        "из нормативных документов (приказов, регламентов). "
        "Если в контексте нет информации для ответа, ответь: "
        "'В загруженных документах нет информации по этому вопросу'. "
        "Не придумывай факты от себя. Отвечай четко и по делу."
    )

    user_prompt = f"Контекст:\n{context}\n\nВопрос: {question}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    try:
        response = chat.invoke(messages)
        return response.content
    except Exception as e:
        logger.error(f"Error calling GigaChat: {e}")
        return "Извините, сервис генерации ответов временно недоступен."