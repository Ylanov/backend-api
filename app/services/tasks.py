# app/services/tasks.py

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Task, TaskComment


# Готовый select со всеми нужными связями
TASK_WITH_RELATIONS = (
    select(Task)
    .options(
        selectinload(Task.team),
        selectinload(Task.zone),
        selectinload(Task.comments).options(
            selectinload(TaskComment.author),
            selectinload(TaskComment.attachments),
        ),
    )
)


def patch_attachments_urls(task: Task, base_url: str) -> None:
    """
    Проставляет .url для всех вложений в комментариях задачи.
    Ничего не возвращает, просто модифицирует объект task.
    """
    if not base_url:
        return

    if not base_url.endswith("/"):
        base_url = base_url + "/"

    for comment in task.comments:
        for att in comment.attachments:
            att.url = f"{base_url}uploads/{att.unique_name}"
