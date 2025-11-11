// frontend/src/pages/AdminLogsPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";

import { useNotification } from "../notifications/NotificationProvider";
import {
  fetchLoginEvents,
  fetchAuditLogs,
  getMe,
  isCanceled,
} from "../services/api";
import type {
  LoginEvent,
  AuditLogEntry,
  Pyrotechnician,
} from "../types";

type TabKey = "logins" | "audit";

export default function AdminLogsPage() {
  const { notifyError } = useNotification();
  const navigate = useNavigate();

  const [me, setMe] = useState<Pyrotechnician | null>(null);
  const [checkingMe, setCheckingMe] = useState(true);

  const [tab, setTab] = useState<TabKey>("logins");

  // login events
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSuccessFilter, setLoginSuccessFilter] = useState<"all" | "success" | "fail">("all");
  const [loginDateFrom, setLoginDateFrom] = useState("");
  const [loginDateTo, setLoginDateTo] = useState("");

  // audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditAction, setAuditAction] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  // проверяем, что пользователь — админ
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await getMe();
        if (!cancelled) {
          setMe(user);
          if (!user.is_admin) {
            notifyError("Доступ в журналы есть только у администраторов.");
            navigate("/");
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          notifyError("Не удалось определить текущего пользователя, требуется вход.");
          navigate("/login");
        }
      } finally {
        if (!cancelled) setCheckingMe(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, notifyError]);

  const cancelPending = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const loadLoginEvents = async () => {
    cancelPending();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoginLoading(true);
    setLoginError(null);

    try {
      const success =
        loginSuccessFilter === "all"
          ? undefined
          : loginSuccessFilter === "success";

      const data = await fetchLoginEvents(
        {
          email: loginEmail || null,
          success,
          date_from: loginDateFrom || null,
          date_to: loginDateTo || null,
        },
        { signal: controller.signal },
      );
      setLoginEvents(data);
    } catch (e: any) {
      if (isCanceled(e)) return;
      const msg = e?.message || "Не удалось загрузить журнал входов.";
      setLoginError(msg);
      notifyError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    cancelPending();
    const controller = new AbortController();
    abortRef.current = controller;

    setAuditLoading(true);
    setAuditError(null);

    try {
      const data = await fetchAuditLogs(
        {
          action: auditAction || null,
          date_from: auditDateFrom || null,
          date_to: auditDateTo || null,
        },
        { signal: controller.signal },
      );
      setAuditLogs(data);
    } catch (e: any) {
      if (isCanceled(e)) return;
      const msg = e?.message || "Не удалось загрузить аудит-лог.";
      setAuditError(msg);
      notifyError(msg);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!checkingMe && me?.is_admin) {
      // по умолчанию грузим логины
      loadLoginEvents();
    }

    return () => {
      cancelPending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingMe, me]);

  if (checkingMe) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!me || !me.is_admin) {
    // редирект уже сделан выше, но на всякий случай
    return null;
  }

  const renderLoginTab = () => (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="h6">Журнал входов</Typography>
          <Tooltip title="Обновить">
            <IconButton onClick={loadLoginEvents} disabled={loginLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "flex-end" }}
          mb={2}
        >
          <TextField
            label="E-mail"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            size="small"
          />
          <TextField
            label="Статус"
            select
            value={loginSuccessFilter}
            onChange={(e) =>
              setLoginSuccessFilter(e.target.value as "all" | "success" | "fail")
            }
            size="small"
            SelectProps={{ native: true }}
          >
            <option value="all">Все</option>
            <option value="success">Успешные</option>
            <option value="fail">Неуспешные</option>
          </TextField>
          <TextField
            label="Дата с"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={loginDateFrom}
            onChange={(e) => setLoginDateFrom(e.target.value)}
          />
          <TextField
            label="Дата по"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={loginDateTo}
            onChange={(e) => setLoginDateTo(e.target.value)}
          />
          <Button
            variant="outlined"
            onClick={loadLoginEvents}
            disabled={loginLoading}
          >
            Применить
          </Button>
        </Stack>

        {loginError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loginError}
          </Alert>
        )}

        {loginLoading ? (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : loginEvents.length === 0 ? (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <Typography color="text.secondary">
              Событий входа пока нет.
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Время</TableCell>
                  <TableCell>Пользователь</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>User-Agent</TableCell>
                  <TableCell>Статус</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loginEvents.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell>
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{e.email ?? "—"}</TableCell>
                    <TableCell>{e.ip_address ?? "—"}</TableCell>
                    <TableCell>
                      {e.user_agent ? (
                        <Tooltip title={e.user_agent}>
                          <span>{e.user_agent.slice(0, 40)}…</span>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={e.success ? "Успешно" : "Ошибка"}
                        color={e.success ? "success" : "error"}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderAuditTab = () => (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="h6">Аудит-лог</Typography>
          <Tooltip title="Обновить">
            <IconButton onClick={loadAuditLogs} disabled={auditLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "flex-end" }}
          mb={2}
        >
          <TextField
            label="Действие (contains)"
            value={auditAction}
            onChange={(e) => setAuditAction(e.target.value)}
            size="small"
          />
          <TextField
            label="Дата с"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={auditDateFrom}
            onChange={(e) => setAuditDateFrom(e.target.value)}
          />
          <TextField
            label="Дата по"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={auditDateTo}
            onChange={(e) => setAuditDateTo(e.target.value)}
          />
          <Button
            variant="outlined"
            onClick={loadAuditLogs}
            disabled={auditLoading}
          >
            Применить
          </Button>
        </Stack>

        {auditError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {auditError}
          </Alert>
        )}

        {auditLoading ? (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : auditLogs.length === 0 ? (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <Typography color="text.secondary">
              Записей аудита пока нет.
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Время</TableCell>
                  <TableCell>Кто</TableCell>
                  <TableCell>Действие</TableCell>
                  <TableCell>Объект</TableCell>
                  <TableCell>Детали</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.actor_email ?? "—"}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      {log.object_type
                        ? `${log.object_type}${
                            log.object_id ? ` #${log.object_id}` : ""
                          }`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {log.details ? (
                        <Tooltip title={log.details}>
                          <IconButton size="small">
                            <InfoOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <SecurityIcon color="primary" />
        <Typography variant="h5">Журналы безопасности</Typography>
      </Stack>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, v: TabKey) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Логины" value="logins" />
            <Tab label="Аудит" value="audit" />
          </Tabs>
        </CardContent>
      </Card>

      {tab === "logins" ? renderLoginTab() : renderAuditTab()}
    </Box>
  );
}
