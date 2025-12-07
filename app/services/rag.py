# app/services/rag.py
import logging
import json
import asyncio
import hashlib
from typing import List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor

# AI & LangChain
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_gigachat.chat_models import GigaChat
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_huggingface import HuggingFaceEmbeddings
from sentence_transformers import CrossEncoder

# DB & Redis
from redis import asyncio as aioredis
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.models import DocumentChunk

logger = logging.getLogger(__name__)

# --- ИНИЦИАЛИЗАЦИЯ (Heavy Models) ---

# 1. ThreadPool для тяжелых вычислений (чтобы не блокировать API)
# Используем кол-во воркеров = кол-ву ядер CPU (примерно)
cpu_executor = ThreadPoolExecutor(max_workers=4)

logger.info("Loading Embedding model...")
embeddings_model = HuggingFaceEmbeddings(
    model_name=settings.EMBEDDING_MODEL_NAME,
    encode_kwargs={'normalize_embeddings': True}
)

logger.info("Loading Reranker model...")
# CrossEncoder загружаем на CPU, он отрабатывает быстро
reranker_model = CrossEncoder(settings.RERANKER_MODEL_NAME, max_length=512)

# Клиент Redis
redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

# GigaChat
chat = GigaChat(
    credentials=settings.GIGACHAT_CREDENTIALS,
    verify_ssl_certs=settings.GIGACHAT_VERIFY_SSL,
    scope=settings.GIGACHAT_SCOPE,
    model="GigaChat",
    temperature=0.4,  # Чуть строже для приказов
)


# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

async def get_embedding_async(text: str) -> List[float]:
    """
    Асинхронная обертка над синхронной моделью.
    Не блокирует Event Loop FastAPI.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(cpu_executor, embeddings_model.embed_query, text)


async def rerank_results(query: str, chunks: List[DocumentChunk], top_k: int = 5) -> List[DocumentChunk]:
    """
    Переранжирование (Re-ranking).
    Сравнивает вопрос и тексты "в лоб" для максимальной точности.
    """
    if not chunks:
        return []

    # Подготовка пар [Вопрос, Текст]
    pairs = [[query, chunk.content] for chunk in chunks]

    # Запускаем в треде
    loop = asyncio.get_running_loop()
    scores = await loop.run_in_executor(cpu_executor, reranker_model.predict, pairs)

    # Собираем пары (Chunk, Score)
    scored_results = sorted(
        zip(chunks, scores),
        key=lambda x: x[1],
        reverse=True
    )

    logger.info(f"Reranking top score: {scored_results[0][1]}")

    # Отсекаем совсем нерелевантное (score > -8.0 опытным путем для BGE) и берем топ-K
    final_chunks = [chunk for chunk, score in scored_results if score > -8.0][:top_k]

    return final_chunks


# --- REDIS CACHE ---

def _get_cache_key(text: str) -> str:
    """Создает хеш вопроса для ключа Redis."""
    hash_obj = hashlib.sha256(text.strip().lower().encode())
    return f"rag_cache:{hash_obj.hexdigest()}"


async def get_cached_answer(question: str) -> Optional[str]:
    key = _get_cache_key(question)
    return await redis_client.get(key)


async def set_cached_answer(question: str, answer: str, ttl: int = 3600 * 24):
    """Кешируем ответ на 24 часа."""
    key = _get_cache_key(question)
    await redis_client.set(key, answer, ex=ttl)


# --- CORE LOGIC ---

async def process_document(db: AsyncSession, file_path: str, doc_id: int) -> None:
    logger.info(f"Started RAG processing for doc_id={doc_id}")
    try:
        # 1. Загрузка с учетом страниц
        raw_docs = []
        if str(file_path).lower().endswith(".pdf"):
            loader = PyPDFLoader(str(file_path))
            # PyPDFLoader автоматически добавляет metadata={'page': 0}
            raw_docs = loader.load()
        else:
            loader = Docx2txtLoader(str(file_path))
            raw_docs = loader.load()
            # Для docx страниц нет, ставим 1
            for d in raw_docs:
                d.metadata['page'] = 1

        if not raw_docs:
            return

        # 2. Нарезка
        # Увеличиваем chunk_size для юридических текстов
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=300,
            separators=["\n\n", "\n", ". ", "; ", " "]
        )
        chunks = text_splitter.split_documents(raw_docs)

        new_chunks = []
        for i, chunk in enumerate(chunks):
            clean_text = chunk.page_content.replace("\x00", "")
            if len(clean_text) < 50:  # Пропускаем мусор
                continue

            # Генерируем вектор асинхронно
            vector = await get_embedding_async(clean_text)

            # Извлекаем номер страницы (PyPDFLoader начинает с 0, добавляем 1)
            page_num = chunk.metadata.get("page", 0)
            if isinstance(page_num, int):
                page_num += 1

            db_chunk = DocumentChunk(
                document_id=doc_id,
                chunk_index=i,
                content=clean_text,
                embedding=vector,
                page_number=page_num
            )
            new_chunks.append(db_chunk)

        if new_chunks:
            db.add_all(new_chunks)
            await db.commit()

        logger.info(f"Document {doc_id} indexed ({len(new_chunks)} chunks).")

    except Exception as e:
        logger.exception(f"Error processing doc {doc_id}: {e}")


async def search_related_chunks(db: AsyncSession, query: str, limit: int = 5) -> List[DocumentChunk]:
    """
    1. Векторный + Ключевой поиск (Retrieval) - берем с запасом
    2. Переранжирование (Reranking) - выбираем топ лучших
    """
    candidates_limit = limit * 4

    # --- 1. Векторный поиск ---
    query_vector = await get_embedding_async(f"query: {query}")

    vector_stmt = select(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_vector)
    ).limit(candidates_limit)

    vector_results = (await db.execute(vector_stmt)).scalars().all()

    # --- 2. Keyword поиск ---
    keyword_stmt = select(DocumentChunk).where(
        text("search_vector @@ websearch_to_tsquery('russian', :q)")
    ).limit(candidates_limit).params(q=query)

    keyword_results = (await db.execute(keyword_stmt)).scalars().all()

    # --- 3. Объединение (Deduplication) ---
    unique_candidates = {c.id: c for c in vector_results}
    for c in keyword_results:
        unique_candidates[c.id] = c

    candidates_list = list(unique_candidates.values())

    if not candidates_list:
        return []

    # --- 4. Переранжирование (Reranking) ---
    final_chunks = await rerank_results(query, candidates_list, top_k=limit)

    return final_chunks


async def generate_answer_stream(context: str, question: str):
    """
    Генератор для стриминга ответа.
    """
    system_prompt = (
        "Ты — юридический ассистент по внутренним приказам. "
        "Отвечай строго на основе контекста. Указывай конкретные пункты или требования. "
        "Если информации нет, так и скажи."
    )
    user_prompt = f"Контекст:\n{context}\n\nВопрос: {question}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    # Используем astream для получения чанков текста
    async for chunk in chat.astream(messages):
        yield chunk.content