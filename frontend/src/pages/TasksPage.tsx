// frontend/src/pages/TasksPage.tsx
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIcon from "@mui/icons-material/Assignment";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ИСПРАВЛЕНИЕ: Убираем неиспользуемые импорты 'Team' и 'Zone'
import type { Task } from "../types";
import { TaskStatus, TaskPriority } from "../types";
import {
  fetchTasks,
  deleteTask,
  fetchTeams,
  fetchZones,
} from "../services/api";
import TaskDialog from "../components/TaskDialog";
import { useNotification } from "../notifications/NotificationProvider";

// Вспомогательные функции (без изменений)
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

export default function TasksPage() {
  const { notifySuccess, notifyError } = useNotification();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // ИСПРАВЛЕНИЕ: Явно указываем generic-типы для useQuery.
  // Это помогает TypeScript не терять контекст и решает ошибки с 'any'.
  const { data: tasks, isLoading: isLoadingTasks, error: tasksError } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  const { data: zones = [], isLoading: isLoadingZones } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
  });

  // ИСПРАВЛЕНИЕ: Упрощаем и исправляем useMutation
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(taskId),
    // onSuccess здесь будет вызываться *после* успешного завершения мутации
    onSuccess: () => {
      // ИСПРАВЛЕНИЕ: Используем 'void', чтобы показать, что мы намеренно игнорируем Promise
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      notifyError(error.message || "Ошибка при удалении задачи.");
    },
  });

  const handleOpenCreate = () => {
    setTaskToEdit(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setTaskToEdit(task);
    setDialogOpen(true);
  };

  const handleDialogClose = () => setDialogOpen(false);

  const handleDialogSave = () => {
    setDialogOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  // ИСПРАВЛЕНИЕ: Корректный вызов мутации
  const handleDelete = (task: Task) => {
    if (window.confirm(`Вы уверены, что хотите удалить задачу "${task.title}"?`)) {
      // Вызываем мутацию, передавая только ID.
      // Для кастомного сообщения об успехе, используем опцию onSuccess прямо здесь.
      deleteMutation.mutate(task.id, {
        onSuccess: () => {
          notifySuccess(`Задача «${task.title}» удалена`);
          // Инвалидация уже настроена в самом хуке useMutation,
          // так что здесь ее можно не дублировать.
        },
      });
    }
  };

  const isLoading = isLoadingTasks || isLoadingTeams || isLoadingZones;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AssignmentIcon color="primary" />
          <Typography variant="h5">Задачи</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Новая задача
        </Button>
      </Stack>

      {tasksError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tasksError.message}
        </Alert>
      )}

      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Название</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Статус</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Приоритет</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Команда</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Зона</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ p: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : !tasks || tasks.length === 0 ? ( // ИСПРАВЛЕНИЕ: Более надежная проверка на !tasks
                <TableRow><TableCell colSpan={6} align="center" sx={{ p: 4 }}><Typography color="text.secondary">Задач пока нет.</Typography></TableCell></TableRow>
              ) : (
                tasks.map((task) => ( // Теперь 'task' имеет правильный тип Task
                  <TableRow key={task.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}><Link component={RouterLink} to={`/tasks/${task.id}`} underline="hover">{task.title}</Link></TableCell>
                    <TableCell><Chip label={statusMap[task.status].label} color={statusMap[task.status].color} size="small" /></TableCell>
                    <TableCell><Chip label={priorityMap[task.priority].label} color={priorityMap[task.priority].color} size="small" variant="outlined" /></TableCell>
                    <TableCell>{task.team?.name ?? "—"}</TableCell>
                    <TableCell>{task.zone?.name ?? "—"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Редактировать"><IconButton onClick={() => handleOpenEdit(task)}><EditIcon /></IconButton></Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton
                          onClick={() => handleDelete(task)}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <TaskDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleDialogSave}
        task={taskToEdit}
        teams={teams}
        zones={zones}
      />
    </Box>
  );
}