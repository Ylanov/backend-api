// components/ZoneInfoPanel.tsx
import { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Alert, Stack, Divider, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { fetchZoneDetails } from "../services/api"; // Вам нужно будет добавить эту функцию в api.ts
import type { ZoneWithTasks } from "../types"; // И этот тип тоже

type Props = { zoneId: number; };

export default function ZoneInfoPanel({ zoneId }: Props) {
    const [zone, setZone] = useState<ZoneWithTasks | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchZoneDetails(zoneId); // Вызываем API
                setZone(data);
            } catch (e: any) {
                setError(e.message || "Не удалось загрузить данные.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [zoneId]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!zone) return null;

    return (
        <Stack spacing={1.5}>
            <Typography variant="h6">{zone.name}</Typography>
            <Typography variant="body2" color="text.secondary">{zone.description}</Typography>
            <Divider />
            <Typography variant="subtitle2">Активные задачи в зоне:</Typography>
            {zone.tasks.length === 0 ? (
                <Typography variant="body2">Нет активных задач.</Typography>
            ) : (
                zone.tasks.map(task => (
                    <Link component={RouterLink} to={`/tasks/${task.id}`} key={task.id}>
                        {task.title}
                    </Link>
                ))
            )}
        </Stack>
    );
}