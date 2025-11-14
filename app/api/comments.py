# app/api/comments.py
from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
)
from starlette.requests import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.settings import settings
from app.database import get_db, SessionLocal
from app.models import (
    Task,
    TaskComment,
    TaskAttachment,
    Pyrotechnician,
    Team,
    Notification,
)
from app.schemas import TaskComment as TaskCommentOut
from app.security import get_current_pyro

router = APIRouter(
    prefix="/tasks",
    tags=["task-comments"],
)

# те же ограничения, что и раньше
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

UPLOAD_DIR = settings.UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def send_comment_notifications_bg(task_id: int, author_id: int) -> None:
    """
    Фоновая задача для отправки уведомлений всем участникам команды,
    кроме автора комментария.
    """
    async with SessionLocal() as db:
        result = await db.execute(
            select(Task)
            .where(Task.id == task_id)
            .options(selectinload(Task.team).selectinload(Team.members))
        )
        task = result.scalars().first()
        author = await db.get(Pyrotechnician, author_id)

        if not task or not task.team or not author:
            print(
                f"DEBUG: Could not send notifications for task {task_id}. "
                f"No task/team/author found."
            )
            return

        message = (
            f"{author.full_name} добавил(а) комментарий к задаче '{task.title}'"
        )
        link = f"/tasks/{task.id}"

        notifications_to_add: List[Notification] = [
            Notification(message=message, link=link, user_id=member.id)
            for member in task.team.members
            if member.id != author_id
        ]

        if notifications_to_add:
            db.add_all(notifications_to_add)
            await db.commit()
            print(
                f"DEBUG: Sent {len(notifications_to_add)} notifications "
                f"for task {task_id}."
            )


# --- НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ---
async def _process_and_validate_attachment(file: UploadFile) -> TaskAttachment:
    """
    Валидирует, сохраняет один файл и возвращает объект TaskAttachment.
    Выбрасывает HTTPException в случае ошибки.
    """
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Тип файла {file.filename} не разрешен. "
                f"Разрешенные типы: {', '.join(ALLOWED_EXTENSIONS)}"
            ),
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Размер файла {file.filename} превышает "
                f"{MAX_FILE_SIZE / (1024 * 1024)}MB"
            ),
        )

    unique_name = f"{uuid.uuid4()}{file_ext}"
    save_path = UPLOAD_DIR / unique_name

    with open(save_path, "wb") as buffer:
        buffer.write(content)

    return TaskAttachment(
        file_name=file.filename,
        unique_name=unique_name,
        mime_type=file.content_type,
    )


@router.post("/{task_id}/comments", response_model=TaskCommentOut)
async def create_task_comment(
    task_id: int,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    text: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_pyro: Pyrotechnician = Depends(get_current_pyro),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not text and not files:
        raise HTTPException(
            status_code=400,
            detail="Comment must have text or attachments.",
        )

    author_id = current_pyro.id
    comment = TaskComment(text=text, task_id=task_id, author_id=author_id)
    db.add(comment)

    # --- УПРОЩЕННЫЙ БЛОК ОБРАБОТКИ ФАЙЛОВ ---
    if files:
        for file in files:
            if not file or not file.filename:
                continue

            # Вся сложная логика теперь в одной функции
            attachment = await _process_and_validate_attachment(file)
            attachment.comment = comment  # Привязываем к комментарию
            db.add(attachment)

    await db.commit()
    await db.refresh(comment)

    # фоновые уведомления
    background_tasks.add_task(
        send_comment_notifications_bg,
        task_id=task.id,
        author_id=author_id,
    )

    # перечитываем комментарий с автором и вложениями
    result = await db.execute(
        select(TaskComment)
        .where(TaskComment.id == comment.id)
        .options(
            selectinload(TaskComment.author),
            selectinload(TaskComment.attachments),
        )
    )
    comment_with_relations = result.scalars().unique().one()

    base_url = str(request.base_url)
    for att in comment_with_relations.attachments:
        att.url = f"{base_url}uploads/{att.unique_name}"

    return comment_with_relations