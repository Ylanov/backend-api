// frontend/src/pages/ReportsPage.tsx
import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import type { Task, Team, Zone } from "../types";
import { TaskStatus, TaskPriority } from "../types";
import {
  fetchTasksReport,
  fetchTeams,
  fetchZones,
  type TaskReportFilters,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";
import PageHeader from "../components/PageHeader";
import { DataTable, type DataTableColumn } from "../components/DataTable";

// DOCX
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: TaskStatus.NEW, label: "Новая" },
  { value: TaskStatus.IN_PROGRESS, label: "В работе" },
  { value: TaskStatus.COMPLETED, label: "Завершена" },
  { value: TaskStatus.CANCELLED, label: "Отменена" },
];

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: TaskPriority.LOW, label: "Низкий" },
  { value: TaskPriority.MEDIUM, label: "Средний" },
  { value: TaskPriority.HIGH, label: "Высокий" },
  { value: TaskPriority.CRITICAL, label: "Критический" },
];

const statusMap: Record<
  TaskStatus,
  { label: string; color: "primary" | "warning" | "success" | "default" }
> = {
  [TaskStatus.NEW]: { label: "Новая", color: "primary" },
  [TaskStatus.IN_PROGRESS]: { label: "В работе", color: "warning" },
  [TaskStatus.COMPLETED]: { label: "Завершена", color: "success" },
  [TaskStatus.CANCELLED]: { label: "Отменена", color: "default" },
};

const priorityMap: Record<
  TaskPriority,
  { label: string; color: "info" | "primary" | "warning" | "error" }
> = {
  [TaskPriority.LOW]: { label: "Низкий", color: "info" },
  [TaskPriority.MEDIUM]: { label: "Средний", color: "primary" },
  [TaskPriority.HIGH]: { label: "Высокий", color: "warning" },
  [TaskPriority.CRITICAL]: { label: "Критический", color: "error" },
};

const EMPTY_FILTERS: TaskReportFilters = {
  date_from: null,
  date_to: null,
  team_id: null,
  zone_id: null,
  status: null,
  priority: null,
};

export default function ReportsPage() {
  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up("sm"));
  const { notifyError, notifySuccess } = useNotification();

  // локальные поля фильтра
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [teamId, setTeamId] = useState<number | "">("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");

  // реально примененные фильтры, которые уходят на бэкенд
  const [currentFilters, setCurrentFilters] =
    useState<TaskReportFilters>(EMPTY_FILTERS);

  // --- справочники: команды и зоны через React Query ---

  const {
    data: teams = [],
    isLoading: isLoadingTeams,
    isError: isTeamsError,
    error: teamsError,
  } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить список команд.";
      notifyError(msg);
    },
  });

  const {
    data: zones = [],
    isLoading: isLoadingZones,
    isError: isZonesError,
    error: zonesError,
  } = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить список зон.";
      notifyError(msg);
    },
  });

  // --- сам отчет по задачам через React Query ---

  const {
    data: tasks = [],
    isLoading: isLoadingReport,
    isFetching: isFetchingReport,
    isError: isReportError,
    error: reportError,
  } = useQuery<Task[], any>({
    queryKey: ["tasks-report", currentFilters],
    queryFn: ({ signal }) => fetchTasksReport(currentFilters, signal),
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить отчет.";
      notifyError(msg);
    },
  });

  const loading = isLoadingReport || isFetchingReport;
  const filtersLoading = isLoadingTeams || isLoadingZones;

  const buildFiltersFromInputs = (): TaskReportFilters => ({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    team_id: teamId === "" ? null : Number(teamId),
    zone_id: zoneId === "" ? null : Number(zoneId),
    status: status || null,
    priority: priority || null,
  });

  const handleApplyFilters = () => {
    const nextFilters = buildFiltersFromInputs();
    setCurrentFilters(nextFilters);
  };

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setTeamId("");
    setZoneId("");
    setStatus("");
    setPriority("");
    setCurrentFilters(EMPTY_FILTERS);
  };

  const handleExportToWord = async () => {
    if (!tasks || tasks.length === 0) {
      notifyError("Нет данных для отчета.");
      return;
    }

    try {
      const filters = currentFilters || EMPTY_FILTERS;
      const filterLines: string[] = [];

      if (filters.date_from) filterLines.push(`С даты: ${filters.date_from}`);
      if (filters.date_to) filterLines.push(`По дату: ${filters.date_to}`);

      if (filters.team_id) {
        const t = teams.find((x) => x.id === filters.team_id);
        if (t) filterLines.push(`Команда: ${t.name}`);
      }

      if (filters.zone_id) {
        const z = zones.find((x) => x.id === filters.zone_id);
        if (z) filterLines.push(`Зона: ${z.name}`);
      }

      if (filters.status) {
        const st = statusOptions.find((s) => s.value === filters.status);
        filterLines.push(`Статус: ${st?.label ?? filters.status}`);
      }

      if (filters.priority) {
        const pr = priorityOptions.find((p) => p.value === filters.priority);
        filterLines.push(`Приоритет: ${pr?.label ?? filters.priority}`);
      }

      if (filterLines.length === 0) {
        filterLines.push("Без фильтров (все задачи).");
      }

      const rows: DocxTableRow[] = [];

      rows.push(
        new DocxTableRow({
          children: [
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "ID", bold: true })],
                }),
              ],
            }),
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Название", bold: true })],
                }),
              ],
            }),
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Статус", bold: true })],
                }),
              ],
            }),
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Приоритет", bold: true })],
                }),
              ],
            }),
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Команда", bold: true })],
                }),
              ],
            }),
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Зона", bold: true })],
                }),
              ],
            }),
            new DocxTableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Дата создания", bold: true })],
                }),
              ],
            }),
          ],
        })
      );

      tasks.forEach((task) => {
        rows.push(
          new DocxTableRow({
            children: [
              new DocxTableCell({ children: [new Paragraph(String(task.id))] }),
              new DocxTableCell({ children: [new Paragraph(task.title)] }),
              new DocxTableCell({
                children: [new Paragraph(statusMap[task.status].label)],
              }),
              new DocxTableCell({
                children: [new Paragraph(priorityMap[task.priority].label)],
              }),
              new DocxTableCell({
                children: [new Paragraph(task.team?.name ?? "—")],
              }),
              new DocxTableCell({
                children: [new Paragraph(task.zone?.name ?? "—")],
              }),
              new DocxTableCell({
                children: [
                  new Paragraph(
                    task.created_at
                      ? format(new Date(task.created_at), "dd.MM.yyyy")
                      : "—"
                  ),
                ],
              }),
            ],
          })
        );
      });

      const table = new DocxTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      });

      const doc = new DocxDocument({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Отчет по задачам", bold: true, size: 32 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Сформирован: ${new Date().toLocaleString()}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({}),
              new Paragraph({
                children: [new TextRun({ text: "Фильтры:", bold: true, size: 24 })],
              }),
              ...filterLines.map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun({ text: line, size: 20 })],
                  })
              ),
              new Paragraph({}),
              table,
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `tasks_report_${new Date()
        .toISOString()
        .slice(0, 10)}.docx`;
      saveAs(blob, fileName);
      notifySuccess("Отчет в формате Word сформирован.");
    } catch (e: any) {
      const msg = e?.message || "Не удалось сформировать Word-отчет.";
      notifyError(msg);
    }
  };

  const combinedFiltersError =
    (isTeamsError && (teamsError as any)?.message) ||
    (isZonesError && (zonesError as any)?.message);

  const reportErrorText = isReportError
    ? (reportError as any)?.message || "Не удалось загрузить отчет."
    : null;

  const columns: DataTableColumn<Task>[] = [
    {
      id: "id",
      label: "ID",
      render: (task) => task.id,
      hideOnXs: true,
    },
    {
      id: "title",
      label: "Название",
      render: (task) => (
        <Typography
          sx={{
            maxWidth: 320,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.title}
        </Typography>
      ),
    },
    {
      id: "status",
      label: "Статус",
      render: (task) => (
        <Chip
          size="small"
          label={statusMap[task.status].label}
          color={statusMap[task.status].color}
        />
      ),
    },
    {
      id: "priority",
      label: "Приоритет",
      render: (task) => (
        <Chip
          size="small"
          label={priorityMap[task.priority].label}
          color={priorityMap[task.priority].color}
          variant="outlined"
        />
      ),
    },
    {
      id: "team",
      label: "Команда",
      render: (task) => task.team?.name ?? "—",
      hideOnXs: true,
    },
    {
      id: "zone",
      label: "Зона",
      render: (task) => task.zone?.name ?? "—",
      hideOnXs: true,
    },
    {
      id: "created_at",
      label: "Дата создания",
      render: (task) =>
        task.created_at
          ? format(new Date(task.created_at), "dd.MM.yyyy")
          : "—",
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Отчеты по задачам"
        subtitle="Фильтрация задач по командам, зонам, статусам и приоритетам, а также экспорт в Word."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              size={smUp ? "medium" : "small"}
              onClick={handleExportToWord}
              disabled={loading || !tasks || tasks.length === 0}
            >
              Экспорт в Word
            </Button>
          </Stack>
        }
      />

      {combinedFiltersError && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography color="error">{combinedFiltersError}</Typography>
        </Paper>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Фильтры
        </Typography>

        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="С даты"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="По дату"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Команда</InputLabel>
              <Select
                label="Команда"
                value={teamId}
                onChange={(e) =>
                  setTeamId(
                    e.target.value === "" ? "" : (e.target.value as number)
                  )
                }
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                {teams.map((t: Team) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Зона</InputLabel>
              <Select
                label="Зона"
                value={zoneId}
                onChange={(e) =>
                  setZoneId(
                    e.target.value === "" ? "" : (e.target.value as number)
                  )
                }
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                {zones.map((z: Zone) => (
                  <MenuItem key={z.id} value={z.id}>
                    {z.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select
                label="Статус"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value === "" ? "" : (e.target.value as TaskStatus)
                  )
                }
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                {statusOptions.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Приоритет</InputLabel>
              <Select
                label="Приоритет"
                value={priority}
                onChange={(e) =>
                  setPriority(
                    e.target.value === ""
                      ? ""
                      : (e.target.value as TaskPriority)
                  )
                }
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                {priorityOptions.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mt: 2 }}
        >
          <Button
            variant="contained"
            onClick={handleApplyFilters}
            disabled={filtersLoading || loading}
          >
            Применить фильтры
          </Button>
          <Button
            variant="outlined"
            onClick={handleResetFilters}
            disabled={filtersLoading || loading}
          >
            Сбросить
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Результаты
        </Typography>

        <DataTable<Task>
          columns={columns}
          rows={tasks}
          getRowId={(t) => t.id}
          loading={loading}
          error={reportErrorText}
          emptyMessage="Данных для отображения нет."
          size={smUp ? "medium" : "small"}
        />
      </Paper>
    </Box>
  );
}
