// frontend/src/pages/AdminLogsPage.tsx
import { useEffect, useState } from "react";
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
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useNotification } from "../notifications/NotificationProvider";
import {
  fetchLoginEvents,
  fetchAuditLogs,
  getMe,
} from "../services/api";
import type {
  LoginEvent,
  AuditLogEntry,
  Pyrotechnician,
} from "../types";
import PageHeader from "../components/PageHeader";

type TabKey = "logins" | "audit";

type LoginSuccessFilter = "all" | "success" | "fail";

interface LoginFilters {
  email: string;
  success: LoginSuccessFilter;
  date_from: string | null;
  date_to: string | null;
}

interface AuditFilters {
  action: string;
  date_from: string | null;
  date_to: string | null;
}

export default function AdminLogsPage() {
  const navigate = useNavigate();
  const { notifyError } = useNotification();

  const [me, setMe] = useState<Pyrotechnician | null>(null);
  const [checkingMe, setCheckingMe] = useState(true);

  const [tab, setTab] = useState<TabKey>("logins");

  // login filters (inputs)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSuccessFilter, setLoginSuccessFilter] =
    useState<LoginSuccessFilter>("all");
  const [loginDateFrom, setLoginDateFrom] = useState("");
  const [loginDateTo, setLoginDateTo] = useState("");

  // applied login filters (для React Query)
  const [loginFilters, setLoginFilters] = useState<LoginFilters>({
    email: "",
    success: "all",
    date_from: null,
    date_to: null,
  });

  // audit filters (inputs)
  const [auditAction, setAuditAction] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  // applied audit filters
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    action: "",
    date_from: null,
    date_to: null,
  });

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
          notifyError(
            "Не удалось определить текущего пользователя, требуется вход."
          );
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

  // --- React Query: журнал входов ---

  const {
    data: loginEvents = [],
    isLoading: isLoginInitialLoading,
    isFetching: isLoginFetching,
    isError: isLoginError,
    error: loginError,
    refetch: refetchLoginEvents,
  } = useQuery<LoginEvent[], any>({
    queryKey: ["admin-login-events", loginFilters],
    queryFn: ({ signal }) => {
      const successValue =
        loginFilters.success === "all"
          ? undefined
          : loginFilters.success === "success";

      return fetchLoginEvents(
        {
          email: loginFilters.email || null,
          success: successValue,
          date_from: loginFilters.date_from,
          date_to: loginFilters.date_to,
        },
        { signal }
      );
    },
    enabled: !!me?.is_admin && tab === "logins",
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить журнал входов.";
      notifyError(msg);
    },
  });

  const loginLoading = isLoginInitialLoading || isLoginFetching;

  // --- React Query: аудит-лог ---

  const {
    data: auditLogs = [],
    isLoading: isAuditInitialLoading,
    isFetching: isAuditFetching,
    isError: isAuditError,
    error: auditError,
    refetch: refetchAuditLogs,
  } = useQuery<AuditLogEntry[], any>({
    queryKey: ["admin-audit-logs", auditFilters],
    queryFn: ({ signal }) =>
      fetchAuditLogs(
        {
          action: auditFilters.action || null,
          date_from: auditFilters.date_from,
          date_to: auditFilters.date_to,
        },
        { signal }
      ),
    enabled: !!me?.is_admin && tab === "audit",
    onError: (e: any) => {
      const msg = e?.message || "Не удалось загрузить аудит-лог.";
      notifyError(msg);
    },
  });

  const auditLoading = isAuditInitialLoading || isAuditFetching;

  const handleApplyLoginFilters = () => {
    setLoginFilters({
      email: loginEmail.trim(),
      success: loginSuccessFilter,
      date_from: loginDateFrom || null,
      date_to: loginDateTo || null,
    });
  };

  const handleApplyAuditFilters = () => {
    setAuditFilters({
      action: auditAction.trim(),
      date_from: auditDateFrom || null,
      date_to: auditDateTo || null,
    });
  };

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
            <IconButton onClick={() => refetchLoginEvents()} disabled={loginLoading}>
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
            label="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            size="small"
          />
          <TextField
            label="Статус"
            select
            value={loginSuccessFilter}
            onChange={(e) =>
              setLoginSuccessFilter(
                e.target.value as LoginSuccessFilter
              )
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
            onClick={handleApplyLoginFilters}
            disabled={loginLoading}
          >
            Применить
          </Button>
        </Stack>

        {isLoginError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(loginError as any)?.message ||
              "Не удалось загрузить журнал входов."}
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
                      {e.success ? (
                        <Chip
                          label="Успешно"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          label="Ошибка"
                          color="error"
                          size="small"
                        />
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

  const renderAuditTab = () => (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="h6">Аудит действий</Typography>
          <Tooltip title="Обновить">
            <IconButton onClick={() => refetchAuditLogs()} disabled={auditLoading}>
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
            onClick={handleApplyAuditFilters}
            disabled={auditLoading}
          >
            Применить
          </Button>
        </Stack>

        {isAuditError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(auditError as any)?.message ||
              "Не удалось загрузить аудит-лог."}
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
      <PageHeader
        title="Журналы входов и действий"
        subtitle="Отслеживание входов пользователей и основных действий в системе."
      />

      <Card
        variant="outlined"
        sx={{ mb: 2, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
      >
        <CardContent sx={{ pb: 0 }}>
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
