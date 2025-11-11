// frontend/src/pages/TaskDetailPage.tsx
import { useMemo, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  Button,
  IconButton,
  Link,
  Avatar,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { TaskAttachment, TaskComment } from "../types";
import { TaskPriority, TaskStatus } from "../types";
import {
  fetchTaskById,
  createTaskCommentWithAttachments,
  type TaskCommentPayload,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

// Вспомогательные маппинги (без изменений)
const statusMap: Record<TaskStatus, { label: string; color: any }> = {
  [TaskStatus.NEW]: { label: "Новая", color: "primary" },
  [TaskStatus.IN_PROGRESS]: { label: "В работе", color: "warning" },
  [TaskStatus.COMPLETED]: { label: "Завершена", color: "success" },
  [TaskStatus.CANCELLED]: { label: "Отменена", color: "default" },
};

const priorityMap: Record<TaskPriority, { label: string; color: any }> = {
  [TaskPriority.LOW]: { label: "Низкий", color: "info" },
  [TaskPriority.MEDIUM]: { label: "Средний", color: "primary" },
  [TaskPriority.HIGH]: { label: "Высокий", color: "warning" },
  [TaskPriority.CRITICAL]: { label: "Критический", color: "error" },
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const { notifyError, notifySuccess } = useNotification();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: task, isLoading, isError, error } = useQuery({
    queryKey: ['task', taskId],
    //
    // ---- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ----
    //
    // Вместо `queryFn: () => fetchTaskById(taskId)` мы передаем саму функцию.
    // React Query автоматически вызовет `fetchTaskById` и передаст ей объект
    // { queryKey: ['task', taskId], signal: AbortSignal, ... }.
    // Наша обновленная `api.ts` умеет извлекать `taskId` из `queryKey`.
    //
    queryFn: fetchTaskById,
    //
    enabled: !isNaN(taskId),
  });

  const createCommentMutation = useMutation({
    mutationFn: (payload: TaskCommentPayload) => createTaskCommentWithAttachments(taskId, payload),
    onSuccess: () => {
      notifySuccess("Комментарий добавлен");
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (error: Error) => {
      notifyError(error.message || "Не удалось добавить комментарий.");
    },
  });

  const orderedComments = useMemo<TaskComment[]>(() => {
    if (!task?.comments) return [];
    return [...task.comments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [task]);

  const handlePickFiles = () => fileInputRef.current?.click();
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = "";
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const resetForm = () => { setCommentText(""); setFiles([]); };

  const handleSendComment = () => {
    if (!commentText.trim() && files.length === 0) {
      notifyError("Напишите текст комментария или приложите файл(ы).");
      return;
    }
    const payload: TaskCommentPayload = {
      text: commentText.trim() || undefined,
      files: files.length ? files : undefined,
    };
    createCommentMutation.mutate(payload);
  };

  if (isNaN(taskId)) {
    return <Box><Alert severity="error">Некорректный идентификатор задачи.</Alert></Box>;
  }

  if (isLoading) {
    return <Box sx={{ textAlign: "center", p: 4 }}><CircularProgress /></Box>;
  }

  if (isError) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Tooltip title="К списку задач"><IconButton component={RouterLink} to="/tasks"><ArrowBackIcon /></IconButton></Tooltip>
          <Typography variant="h5">Задача</Typography>
        </Stack>
        <Alert severity="error">{(error as Error).message}</Alert>
      </Box>
    );
  }

  if (!task) {
    return <Box><Alert severity="warning">Задача не найдена.</Alert></Box>;
  }

  const isSendingComment = createCommentMutation.isPending;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Tooltip title="К списку задач"><IconButton component={RouterLink} to="/tasks"><ArrowBackIcon /></IconButton></Tooltip>
        <Typography variant="h5" sx={{ mr: 1 }}>{task.title}</Typography>
        <Chip size="small" label={statusMap[task.status].label} color={statusMap[task.status].color} />
        <Chip size="small" label={priorityMap[task.priority].label} color={priorityMap[task.priority].color} variant="outlined" sx={{ ml: 1 }} />
      </Stack>

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
            <Box sx={{ minWidth: 280 }}>
              <Typography variant="subtitle2" color="text.secondary">Команда</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{task.team?.name ?? "—"}</Typography>
              <Typography variant="subtitle2" color="text.secondary">Рабочая зона</Typography>
              <Typography variant="body1">{task.zone?.name ?? "—"}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Описание</Typography>
              <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{task.description?.trim() ? task.description : "—"}</Typography>
            </Box>
          </Stack>
        </Box>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1.5 }}>Комментарии</Typography>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ p: 2 }}>
          {orderedComments.length === 0 ? (
            <Typography color="text.secondary">Пока нет комментариев.</Typography>
          ) : (
            <Stack spacing={2}>
              {orderedComments.map((c: TaskComment) => (
                <Box key={c.id}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar sx={{ width: 32, height: 32 }}>{(c.author?.full_name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}</Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2">{c.author?.full_name || "Неизвестный пользователь"}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</Typography>
                      </Stack>
                      {c.text?.trim() && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: c.attachments?.length ? 1 : 0 }}>{c.text}</Typography>}
                      {c.attachments?.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {c.attachments.map((att: TaskAttachment) => (
                            <Button key={att.id} size="small" variant="outlined" startIcon={<AttachFileIcon />} component={Link} href={att.url} target="_blank" rel="noopener noreferrer">
                              {att.file_name}
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>

      <Paper variant="outlined">
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Добавить комментарий</Typography>
          <Stack spacing={1.5}>
            <TextField label="Текст комментария" multiline minRows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} disabled={isSendingComment} fullWidth />
            {files.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap">{files.map((f, idx) => (<Chip key={`${f.name}-${idx}`} label={f.name} onDelete={() => removeFile(idx)} variant="outlined" />))}</Stack>
            )}
            <Stack direction="row" spacing={1}>
              <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
              <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={handlePickFiles} disabled={isSendingComment}>Прикрепить файлы</Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button variant="contained" endIcon={<SendIcon />} disabled={isSendingComment || (!commentText.trim() && files.length === 0)} onClick={handleSendComment}>
                {isSendingComment ? "Отправка..." : "Отправить"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}