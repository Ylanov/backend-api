// frontend/src/pages/DashboardPage.tsx
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Grid,
  CircularProgress,
  Alert,
  Link,
  Drawer,
  IconButton,
  Divider,
  Chip,
} from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import CloseIcon from "@mui/icons-material/Close";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { YMaps, Map, Polygon, Placemark } from "@pbe/react-yandex-maps";
import { useQuery } from "@tanstack/react-query";

import type { Task, Zone, ZoneWithTasks } from "../types";
import { TaskStatus } from "../types";
import { fetchTasks, fetchTeams, fetchZones, fetchZoneDetails } from "../services/api";
import { useAuth } from "../auth/AuthProvider";

// --- Вспомогательные компоненты ---

const TaskInfoPanel = ({
  taskId,
  allTasks,
}: {
  taskId: number;
  allTasks: Task[];
}) => {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) {
    return (
      <Typography color="error">
        Ошибка: Задача с ID {taskId} не найдена.
      </Typography>
    );
  }
  return (
    <Stack spacing={2} sx={{ p: 1 }}>
      <Typography variant="h6">{task.title}</Typography>
      <Stack direction="row" spacing={1}>
        <Chip label={task.status} color="primary" size="small" />
        <Chip label={task.priority} variant="outlined" size="small" />
      </Stack>
      <Divider />
      <Typography variant="subtitle2" color="text.secondary">
        Команда
      </Typography>
      <Typography>{task.team?.name ?? "Не назначена"}</Typography>
      <Typography variant="subtitle2" color="text.secondary">
        Описание
      </Typography>
      <Typography
        variant="body2"
        sx={{ maxHeight: 150, overflowY: "auto" }}
      >
        {task.description || "Нет описания."}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Link component={RouterLink} to={`/tasks/${task.id}`} sx={{ mt: "auto" }}>
        Перейти к полной информации →
      </Link>
    </Stack>
  );
};

const ZoneInfoPanel = ({ zoneId }: { zoneId: number }) => {
  const {
    data: zone,
    isLoading,
    isError,
    error,
  } = useQuery<ZoneWithTasks>({
    queryKey: ["zoneDetails", zoneId],
    queryFn: fetchZoneDetails,
    enabled: !!zoneId,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {(error as Error).message || "Не удалось загрузить данные зоны."}
      </Alert>
    );
  }

  if (!zone) return null;

  const tasks = zone.tasks ?? [];

  return (
    <Stack spacing={2} sx={{ p: 1 }}>
      <Typography variant="h6">{zone.name}</Typography>
      <Typography variant="body2" color="text.secondary">
        {zone.description || "Нет описания."}
      </Typography>
      <Divider />
      <Typography variant="subtitle2">Активные задачи в зоне:</Typography>

      {tasks.length > 0 ? (
        <Stack spacing={1}>
          {tasks.map((task) => (
            <Link component={RouterLink} to={`/tasks/${task.id}`} key={task.id}>
              {task.title}
            </Link>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Нет активных задач.
        </Typography>
      )}
    </Stack>
  );
};

const StatCard = ({
  title,
  value,
  icon,
  color,
  to,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  to?: string;
}) => (
  <Link
    component={RouterLink}
    to={to || "#"}
    underline="none"
    sx={{ pointerEvents: to ? "auto" : "none", height: "100%" }}
  >
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: "100%",
        "&:hover": {
          boxShadow: to ? 3 : 0,
          borderColor: to ? "primary.main" : "divider",
        },
      }}
    >
      <Box sx={{ color }}>{icon}</Box>
      <Box>
        <Typography variant="h4" component="div" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
    </Paper>
  </Link>
);

type SelectedObject = { type: "task" | "zone"; id: number };

// --- Основной компонент страницы ---

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(
    null
  );

  const {
    data: tasks = [],
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    initialData: [],
  });

  const {
    data: teams = [],
    isLoading: isLoadingTeams,
    error: teamsError,
  } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    initialData: [],
  });

  const {
    data: zones = [],
    isLoading: isLoadingZones,
    error: zonesError,
  } = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
    initialData: [],
  });

  const isLoading = isLoadingTasks || isLoadingTeams || isLoadingZones;
  const error = tasksError || teamsError || zonesError;

  const stats = useMemo(() => {
    const tasksInProgress = tasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS
    ).length;

    const assignedTeamIds = new Set(
      tasks
        .filter((t) => t.status === TaskStatus.IN_PROGRESS && t.team_id)
        .map((t) => t.team_id)
    );

    const freeTeams = teams.filter((t) => !assignedTeamIds.has(t.id)).length;

    return { tasksInProgress, freeTeams };
  }, [tasks, teams]);

  const mapCenter = useMemo(() => {
    if (zones.length > 0 && zones[0].points.length > 0) {
      return [zones[0].points[0].lat, zones[0].points[0].lng] as [
        number,
        number
      ];
    }
    return [55.75, 37.57] as [number, number];
  }, [zones]);

  const yandexMapsApiKey = import.meta.env.VITE_YMAPS_API_KEY;

  const handleTaskClick = (task: Task) =>
    setSelectedObject({ type: "task", id: task.id });
  const handleZoneClick = (zone: Zone) =>
    setSelectedObject({ type: "zone", id: zone.id });
  const handleCloseDrawer = () => setSelectedObject(null);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
        <MapIcon fontSize="large" />
        <Typography variant="h4">Оперативная карта</Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message}
        </Alert>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Задач в работе"
            value={isLoading ? <CircularProgress size={30} /> : stats.tasksInProgress}
            icon={<AssignmentTurnedInIcon sx={{ fontSize: 40 }} />}
            color="warning.main"
            to="/tasks"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Свободных команд"
            value={isLoading ? <CircularProgress size={30} /> : stats.freeTeams}
            icon={<PeopleOutlineIcon sx={{ fontSize: 40 }} />}
            color="success.main"
            to="/structure"
          />
        </Grid>

        {user?.is_admin && (
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Администрирование"
              value="Открыть"
              icon={<AdminPanelSettingsIcon sx={{ fontSize: 40 }} />}
              color="info.main"
              to="/admin"
            />
          </Grid>
        )}
      </Grid>

      <Paper variant="outlined" sx={{ height: "65vh", position: "relative" }}>
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        ) : !yandexMapsApiKey ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Ключ API Яндекс.Карт не найден. Карта не может быть отображена.
          </Alert>
        ) : (
          <YMaps query={{ apikey: yandexMapsApiKey }}>
            <Map
              width="100%"
              height="100%"
              defaultState={{ center: mapCenter, zoom: 9 }}
            >
              {zones.map((zone) => (
                <Polygon
                  key={zone.id}
                  geometry={[zone.points.map((p) => [p.lat, p.lng])]}
                  options={{
                    fillColor: "#0066ff22",
                    strokeColor: "#0066ff",
                    strokeWidth: 2,
                    cursor: "pointer",
                  }}
                  onClick={() => handleZoneClick(zone)}
                />
              ))}

              {tasks
                .filter(
                  (task) =>
                    task.zone &&
                    task.zone.points.length > 0 &&
                    task.status !== TaskStatus.COMPLETED
                )
                .map((task) => (
                  <Placemark
                    key={task.id}
                    geometry={[
                      task.zone!.points[0].lat,
                      task.zone!.points[0].lng,
                    ]}
                    properties={{ iconCaption: task.title }}
                    options={{
                      preset:
                        task.priority === "critical"
                          ? "islands#redDotIconWithCaption"
                          : "islands#blueDotIconWithCaption",
                      cursor: "pointer",
                    }}
                    onClick={() => handleTaskClick(task)}
                  />
                ))}
            </Map>
          </YMaps>
        )}
      </Paper>

      <Drawer
        anchor="right"
        open={selectedObject !== null}
        onClose={handleCloseDrawer}
        PaperProps={{ sx: { width: { xs: "90%", sm: 400 } } }}
      >
        <Box
          sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%" }}
        >
          <IconButton
            onClick={handleCloseDrawer}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            <CloseIcon />
          </IconButton>

          {selectedObject?.type === "task" && (
            <TaskInfoPanel taskId={selectedObject.id} allTasks={tasks} />
          )}
          {selectedObject?.type === "zone" && (
            <ZoneInfoPanel zoneId={selectedObject.id} />
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
