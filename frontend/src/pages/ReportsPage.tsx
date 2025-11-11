// frontend/src/pages/ReportsPage.tsx
import { useEffect, useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DownloadIcon from "@mui/icons-material/Download";

import { format } from "date-fns";

import type { Task, Team, Zone } from "../types";
import { TaskStatus, TaskPriority } from "../types";
import {
  fetchTasksReport,
  fetchTeams,
  fetchZones,
  isCanceled,
  type TaskReportFilters,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

// Для генерации Word-отчета
import {
  Document,
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

export default function ReportsPage() {
  const { notifyError, notifySuccess } = useNotification();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // фильтры
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [teamId, setTeamId] = useState<number | "">("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");

  // для отмены запросов
  const abortRef = useRef<AbortController | null>(null);

  const buildFilters = (): TaskReportFilters => ({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    team_id: teamId === "" ? null : Number(teamId),
    zone_id: zoneId === "" ? null : Number(zoneId),
    status: status || null,
    priority: priority || null,
  });

  const loadFiltersData = async () => {
    try {
      const [teamsData, zonesData] = await Promise.all([
        fetchTeams(),
        fetchZones(),
      ]);
      setTeams(teamsData);
      setZones(zonesData);
    } catch (e: any) {
      const msg = e?.message || "Не удалось загрузить справочники.";
      notifyError(msg);
    }
  };

  const loadReport = async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const filters = buildFilters();
      const data = await fetchTasksReport(filters, controller.signal);
      setTasks(data);
    } catch (e: any) {
      if (isCanceled(e)) return;
      const msg = e?.message || "Не удалось загрузить отчет.";
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiltersData();
    loadReport();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    loadReport();
  };

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setTeamId("");
    setZoneId("");
    setStatus("");
    setPriority("");
    loadReport();
  };

  const handleExportWord = async () => {
    if (tasks.length === 0) {
      notifyError("Нет данных для отчета.");
      return;
    }

    try {
      const filters = buildFilters();
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
        const s = statusOptions.find((x) => x.value === filters.status);
        if (s) filterLines.push(`Статус: ${s.label}`);
      }
      if (filters.priority) {
        const p = priorityOptions.find((x) => x.value === filters.priority);
        if (p) filterLines.push(`Приоритет: ${p.label}`);
      }
      if (filterLines.length === 0) {
        filterLines.push("Без фильтров (все задачи).");
      }

      const rows: DocxTableRow[] = [];

      // шапка таблицы
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
                  children: [
                    new TextRun({ text: "Дата создания", bold: true }),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      // строки по задачам
      tasks.forEach((task) => {
        rows.push(
          new DocxTableRow({
            children: [
              new DocxTableCell({
                children: [new Paragraph(String(task.id))],
              }),
              new DocxTableCell({
                children: [new Paragraph(task.title)],
              }),
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
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        rows,
      });

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Отчет по задачам",
                    bold: true,
                    size: 32,
                  }),
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
                children: [
                  new TextRun({
                    text: "Фильтры:",
                    bold: true,
                    size: 24,
                  }),
                ],
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
      console.error(e);
      const msg = e?.message || "Не удалось сформировать Word-отчет.";
      notifyError(msg);
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AssessmentIcon color="primary" />
          <Typography variant="h5">Отчеты по задачам</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleResetFilters}>
            Сбросить фильтры
          </Button>
          <Button variant="contained" onClick={handleApplyFilters}>
            Обновить отчет
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<DownloadIcon />}
            onClick={handleExportWord}
          >
            Word-отчет
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6} lg={4}>
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
          <Grid item xs={12} md={6} lg={4}>
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
          <Grid item xs={12} md={6} lg={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Команда</InputLabel>
              <Select
                label="Команда"
                value={teamId}
                onChange={(e) =>
                  setTeamId(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                {teams.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Зона</InputLabel>
              <Select
                label="Зона"
                value={zoneId}
                onChange={(e) =>
                  setZoneId(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <MenuItem value="">
                  <em>Все</em>
                </MenuItem>
                {zones.map((z) => (
                  <MenuItem key={z.id} value={z.id}>
                    {z.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
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
          <Grid item xs={12} md={6} lg={4}>
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
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>ID</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Название</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Статус</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Приоритет</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Команда</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Зона</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>
                  Дата создания
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ p: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ p: 4 }}>
                    <Typography color="text.secondary">
                      Данных для отображения нет.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id} hover>
                    <TableCell>{task.id}</TableCell>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={statusMap[task.status].label}
                        color={statusMap[task.status].color}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={priorityMap[task.priority].label}
                        color={priorityMap[task.priority].color}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{task.team?.name ?? "—"}</TableCell>
                    <TableCell>{task.zone?.name ?? "—"}</TableCell>
                    <TableCell>
                      {task.created_at
                        ? format(new Date(task.created_at), "dd.MM.yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
