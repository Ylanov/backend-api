// components/TaskInfoPanel.tsx
import { Box, Typography, Chip, Divider, Link, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { Task } from "../types";

type Props = { taskId: number; allTasks: Task[]; };

export default function TaskInfoPanel({ taskId, allTasks }: Props) {
    const task = allTasks.find(t => t.id === taskId);

    if (!task) {
        return <Typography color="error">Задача не найдена.</Typography>;
    }

    return (
        <Stack spacing={1.5}>
            <Typography variant="h6">{task.title}</Typography>
            <Stack direction="row" spacing={1}>
                <Chip label={task.status} color="primary" size="small" />
                <Chip label={task.priority} variant="outlined" size="small" />
            </Stack>
            <Divider />
            <Typography variant="subtitle2">Команда:</Typography>
            <Typography>{task.team?.name ?? "Не назначена"}</Typography>
            <Typography variant="subtitle2">Последние комментарии:</Typography>
            {/* Здесь можно вывести последние 2-3 комментария */}
            {task.comments?.slice(-2).map(c => <Typography key={c.id}>- {c.text}</Typography>)}
            <Box sx={{ flexGrow: 1 }} />
            <Link component={RouterLink} to={`/tasks/${task.id}`}>
                Перейти к задаче →
            </Link>
        </Stack>
    );
}