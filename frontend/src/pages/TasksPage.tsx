// frontend/src/pages/TasksPage.tsx
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { Task } from "../types";
import { TaskStatus, TaskPriority } from "../types";
import { fetchTasks, deleteTask, fetchTeams, fetchZones } from "../services/api";
import TaskDialog from "../components/TaskDialog";
import { useNotification } from "../notifications/NotificationProvider";
import PageHeader from "../components/PageHeader";

// Мапы статусов/приоритетов
const statusMap: Record<TaskStatus, { label: string; color: "primary" | "warning" | "success" | "default" }> = {
  [TaskStatus.NEW]: { label: "Новая", color: "primary" },
  [TaskStatus.IN_PROGRESS]: { label: "В работе", color: "warning" },
  [TaskStatus.COMPLETED]: { label: "Завершена", color: "success" },
  [TaskStatus.CANCELLED]: { label: "Отменена", color: "default" },
};

const priorityMap: Record<TaskPriority, { label: string; color: "info" | "primary" | "warning" | "error" }> = {
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

  const {
    data: tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  // Эти запросы нужны для TaskDialog
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
  });

  const { data: zones = [], isLoading: isLoadingZones } = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const handleDelete = (task: Task) => {
    if (window.confirm(`Вы уверены, что хотите удалить задачу "${task.title}"?`)) {
      deleteMutation.mutate(task.id, {
        onSuccess: () => {
          notifySuccess(`Задача «${task.title}» удалена`);
        },
      });
    }
  };

  const isLoading = isLoadingTasks || isLoadingTeams || isLoadingZones;

  return (
    <Box>
      <PageHeader
        title="Задачи"
        subtitle="Управляйте задачами, командами и зонами"
        sticky
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Новая задача
          </Button>
        }
      />

      {tasksError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tasksError.message}
        </Alert>
      )}

      <Paper variant="outlined">
        <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Название</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Статус</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Приоритет</TableCell>
                {/* На телефоне прячем «Команда» и «Зона», чтобы таблица не рвалась */}
                <TableCell sx={{ fontWeight: "bold", display: { xs: "none", sm: "table-cell" } }}>
                  Команда
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", display: { xs: "none", sm: "table-cell" } }}>
                  Зона
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  Действия
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ p: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : !tasks || tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ p: 4 }}>
                    <Typography color="text.secondary">Задач пока нет.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id} hover>
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        maxWidth: 360,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Link component={RouterLink} to={`/tasks/${task.id}`} underline="hover">
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip label={statusMap[task.status].label} color={statusMap[task.status].color} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={priorityMap[task.priority].label}
                        color={priorityMap[task.priority].color}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {task.team?.name ?? "—"}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {task.zone?.name ?? "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Редактировать">
                        <IconButton onClick={() => handleOpenEdit(task)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton
                          onClick={() => handleDelete(task)}
                          disabled={deleteMutation.isPending}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
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
