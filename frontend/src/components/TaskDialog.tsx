// frontend/src/components/TaskDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";

import type { Task, TaskCreate, TaskUpdate, Team, Zone } from "../types";
import { TaskStatus, TaskPriority } from "../types";
import { createTask, updateTask } from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  task: Task | null;
  teams: Team[];
  zones: Zone[];
};

export default function TaskDialog({
  open,
  onClose,
  onSave,
  task,
  teams,
  zones,
}: Props) {
  const { notifySuccess, notifyError } = useNotification();

  const isEditing = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.NEW);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [teamId, setTeamId] = useState<number | "">("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? TaskStatus.NEW);
      setPriority(task?.priority ?? TaskPriority.MEDIUM);
      setTeamId(task?.team_id ?? "");
      setZoneId(task?.zone_id ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, task]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Название задачи не может быть пустым.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: TaskCreate | TaskUpdate = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        team_id: teamId ? Number(teamId) : null,
        zone_id: zoneId ? Number(zoneId) : null,
      };

      if (isEditing && task) {
        await updateTask(task.id, payload as TaskUpdate);
        notifySuccess(`Задача «${payload.title}» успешно обновлена`);
      } else {
        await createTask(payload as TaskCreate);
        notifySuccess(`Задача «${payload.title}» успешно создана`);
      }

      onSave();
      onClose();
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ??
        e?.responseData?.detail ??
        e?.message ??
        "Не удалось сохранить задачу";
      setError(String(detail));
      notifyError(String(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isEditing ? "Редактирование задачи" : "Новая задача"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Название задачи *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            disabled={submitting}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={submitting}>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={status}
                  label="Статус"
                  onChange={(e) =>
                    setStatus(e.target.value as TaskStatus)
                  }
                >
                  <MenuItem value={TaskStatus.NEW}>Новая</MenuItem>
                  <MenuItem value={TaskStatus.IN_PROGRESS}>В работе</MenuItem>
                  <MenuItem value={TaskStatus.COMPLETED}>Завершена</MenuItem>
                  <MenuItem value={TaskStatus.CANCELLED}>Отменена</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={submitting}>
                <InputLabel>Приоритет</InputLabel>
                <Select
                  value={priority}
                  label="Приоритет"
                  onChange={(e) =>
                    setPriority(e.target.value as TaskPriority)
                  }
                >
                  <MenuItem value={TaskPriority.LOW}>Низкий</MenuItem>
                  <MenuItem value={TaskPriority.MEDIUM}>Средний</MenuItem>
                  <MenuItem value={TaskPriority.HIGH}>Высокий</MenuItem>
                  <MenuItem value={TaskPriority.CRITICAL}>
                    Критический
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={submitting}>
                <InputLabel>Назначенная команда</InputLabel>
                <Select
                  value={teamId}
                  label="Назначенная команда"
                  onChange={(e) =>
                    setTeamId(e.target.value as number | "")
                  }
                >
                  <MenuItem value="">
                    <em>Не назначена</em>
                  </MenuItem>
                  {teams.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={submitting}>
                <InputLabel>Рабочая зона</InputLabel>
                <Select
                  value={zoneId}
                  label="Рабочая зона"
                  onChange={(e) =>
                    setZoneId(e.target.value as number | "")
                  }
                >
                  <MenuItem value="">
                    <em>Не указана</em>
                  </MenuItem>
                  {zones.map((z) => (
                    <MenuItem key={z.id} value={z.id}>
                      {z.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !title.trim()}
          startIcon={
            submitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : undefined
          }
        >
          {submitting ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
