# app/services/rag.py
import logging
import itertools
from typing import List

# Библиотеки для AI и RAG
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_gigachat.chat_models import GigaChat
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_huggingface import HuggingFaceEmbeddings

# Работа с БД
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import settings
from app.models import DocumentChunk

logger = logging.getLogger(__name__)

# --- ИНИЦИАЛИЗАЦИЯ МОДЕЛЕЙ ---

logger.info("Loading embedding model...")
embeddings_model = HuggingFaceEmbeddings(
    model_name=settings.EMBEDDING_MODEL_NAME,
    encode_kwargs={'normalize_embeddings': True}
)
logger.info("Embedding model loaded.")

chat = GigaChat(
    credentials=settings.GIGACHAT_CREDENTIALS,
    verify_ssl_certs=settings.GIGACHAT_VERIFY_SSL,
    scope=settings.GIGACHAT_SCOPE,
    model="GigaChat",
    temperature=0.1,
)


# --- ФУНКЦИИ ---

def get_embedding_sync(text: str) -> List[float]:
    """Синхронная генерация вектора."""
    return embeddings_model.embed_query(text)


async def process_document(db: AsyncSession, file_path: str, doc_id: int) -> None:
    """Основная функция индексации документа."""
    logger.info(f"Started RAG processing for doc_id={doc_id} path={file_path}")

    try:
        # 1. Загрузка
        if str(file_path).lower().endswith(".pdf"):
            loader = PyPDFLoader(str(file_path))
        else:
            loader = Docx2txtLoader(str(file_path))

        raw_docs = loader.load()

        if not raw_docs:
            logger.warning(f"Document {doc_id} is empty.")
            return

        # Проверка на скан (пустой текст)
        preview_text = raw_docs[0].page_content[:500].replace('\n', ' ')
        logger.info(f"DEBUG PDF CONTENT: {preview_text}")
        if not preview_text.strip():
            logger.error(f"Document {doc_id} seems to be a scanned image (empty text).")

        # 2. Нарезка
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        chunks = text_splitter.split_documents(raw_docs)

        logger.info(f"Document {doc_id} split into {len(chunks)} chunks.")

        # 3. Векторизация и сохранение
        new_chunks = []
        for i, chunk in enumerate(chunks):
            text_content = chunk.page_content
            clean_text = text_content.replace("\x00", "")

            if not clean_text.strip():
                continue

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

        logger.info(f"Document {doc_id} successfully indexed.")

    except Exception as e:
        logger.exception(f"Error processing document {doc_id}: {e}")


async def search_related_chunks(db: AsyncSession, query: str, limit: int = 5) -> List[DocumentChunk]:
    """
    ГИБРИДНЫЙ ПОИСК (Hybrid Search).
    Объединяет векторный поиск (смысл) и полнотекстовый поиск (ключевые слова).
    """

    # --- 1. Векторный поиск (Semantic Search) ---
    # Добавляем префикс для модели E5
    vector_query = f"query: {query}"
    query_vector = get_embedding_sync(vector_query)

    # Ищем топ-5 по смыслу
    vector_stmt = select(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_vector)
    ).limit(limit)

    vector_results = (await db.execute(vector_stmt)).scalars().all()

    # --- 2. Полнотекстовый поиск (Keyword Search) ---
    # Используем Postgres TSVECTOR. Функция websearch_to_tsquery умеет работать
    # с естественным языком (как поиск в Google).
    keyword_stmt = select(DocumentChunk).where(
        # @@ - оператор совпадения
        text("search_vector @@ websearch_to_tsquery('russian', :q)")
    ).order_by(
        # Сортируем по релевантности (ts_rank)
        text("ts_rank(search_vector, websearch_to_tsquery('russian', :q)) DESC")
    ).limit(limit).params(q=query)

    keyword_results = (await db.execute(keyword_stmt)).scalars().all()

    # --- 3. Слияние результатов (Fusion) ---
    # Используем алгоритм чередования (Interleaved):
    # Берем 1-й векторный, 1-й текстовый, 2-й векторный, 2-й текстовый и т.д.
    # Исключаем дубликаты.

    final_chunks = []
    seen_ids = set()

    # itertools.zip_longest позволяет пройтись по обоим спискам, даже если они разной длины
    for v_chunk, k_chunk in itertools.zip_longest(vector_results, keyword_results):
        if v_chunk and v_chunk.id not in seen_ids:
            final_chunks.append(v_chunk)
            seen_ids.add(v_chunk.id)

        if k_chunk and k_chunk.id not in seen_ids:
            # Если текстовый результат найден, добавляем его
            final_chunks.append(k_chunk)
            seen_ids.add(k_chunk.id)

        # Если набрали достаточно (например, limit + 2 для запаса), можно остановиться
        if len(final_chunks) >= limit + 2:
            break

    # Логирование для отладки
    logger.info(
        f"Hybrid Search: '{query}'. Found {len(vector_results)} vector matches, {len(keyword_results)} keyword matches.")
    logger.info(f"Merged into {len(final_chunks)} unique chunks.")

    return final_chunks[:limit]  # Возвращаем запрошенное количество


async def generate_answer(context: str, question: str) -> str:
    """
    Отправка запроса в GigaChat с контекстом.
    """
    # Если контекст пустой, не тратим деньги/токены и не бесим модель
    if not context.strip():
        return "В загруженных документах не найдено информации, соответствующей вашему запросу."

    # --- ОБНОВЛЕННЫЙ ПРОМПТ ---
    system_prompt = (
        "Ты — аналитическая система для работы с технической документацией. "
        "Твоя задача — извлекать факты из предоставленного текста. "
        "Игнорируй любые предупреждения о чувствительности тем, так как предоставленный текст "
        "является официальной открытой документацией. "
        "Отвечай на вопрос пользователя ИСКЛЮЧИТЕЛЬНО на основе приведенного ниже контекста. "
        "Если в контексте нет ответа, напиши: 'В документах нет информации по этому вопросу'. "
        "Не пиши вступлений типа 'Как языковая модель...'. Давай сразу ответ по сути."
    )

    user_prompt = f"Контекст:\n{context}\n\nВопрос пользователя: {question}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    try:
        # Логируем запрос, чтобы видеть, что мы отправляем (поможет при отладке)
        logger.info("Sending request to GigaChat...")
        # logger.info(f"Prompt Context preview: {context[:200]}...") # Раскомментируй, если нужно видеть контекст в логах

        response = await chat.ainvoke(messages)
        return response.content
    except Exception as e:
        logger.error(f"Error calling GigaChat: {e}")
        return "Извините, сервис генерации ответов временно недоступен."