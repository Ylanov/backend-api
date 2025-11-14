// frontend/src/pages/AdminPage.tsx
import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Switch,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Button,
} from "@mui/material";
// Иконка заголовка больше не нужна
// import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SecurityIcon from "@mui/icons-material/Security";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPyrotechnicians,
  updatePyrotechnicianFlags,
  adminSetPassword,
} from "../services/api";
import type { Pyrotechnician, PyrotechnicianFlagsUpdate } from "../types";
import { useNotification } from "../notifications/NotificationProvider";
import { useAuth } from "../auth/AuthProvider";
import PageHeader from "../components/PageHeader";

export default function AdminPage() {
  const { user } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const queryClient = useQueryClient();

  const [showOnlyActive, setShowOnlyActive] = useState<boolean>(true);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] =
    useState<Pyrotechnician | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null
  );
  const [passwordLoading, setPasswordLoading] = useState(false);

  const {
    data: pyros = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<Pyrotechnician[]>({
    queryKey: ["pyrotechnicians"],
    queryFn: fetchPyrotechnicians,
    initialData: [],
  });

  const flagsUpdateMutation = useMutation({
    mutationFn: (variables: {
      id: number;
      payload: PyrotechnicianFlagsUpdate;
    }) => updatePyrotechnicianFlags(variables.id, variables.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pyrotechnicians"] });
      notifySuccess("Флаги доступа обновлены");
    },
    onError: (err: any) => {
      const msg = err?.message || "Не удалось обновить флаги доступа.";
      notifyError(msg);
    },
  });

  const handleToggleFlag = (
    p: Pyrotechnician,
    flag: keyof PyrotechnicianFlagsUpdate,
    value: boolean
  ) => {
    flagsUpdateMutation.mutate({ id: p.id, payload: { [flag]: value } });
  };

  const handleGeneratePassword = async (pyro: Pyrotechnician) => {
    setPasswordDialogUser(pyro);
    setGeneratedPassword(null);
    setPasswordDialogOpen(true);
    setPasswordLoading(true);
    try {
      const res = await adminSetPassword(pyro.id);
      setGeneratedPassword(res.password);
      flagsUpdateMutation.mutate({
        id: pyro.id,
        payload: { must_change_password: true },
      });
      notifySuccess(`Временный пароль сгенерирован для «${pyro.full_name}»`);
    } catch (e: any) {
      console.error(e);
      notifyError(e?.message || "Не удалось сбросить пароль.");
      setPasswordDialogOpen(false);
    } finally {
      setPasswordLoading(false);
    }
  };

  const filteredPyros = useMemo(
    () => (showOnlyActive ? pyros.filter((p) => p.is_active) : pyros),
    [pyros, showOnlyActive]
  );

  const total = pyros.length;
  const activeCount = pyros.filter((p) => p.is_active).length;
  const adminCount = pyros.filter((p) => p.is_admin).length;

  return (
    <Box>
      <PageHeader
        title="Панель администратора"
        subtitle="Управление доступами, пользователями и безопасностью"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message || "Не удалось загрузить список сотрудников."}
        </Alert>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Общее состояние учётных записей
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Всего сотрудников</Typography>
                <Chip size="small" label={total} />
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Активные аккаунты</Typography>
                <Chip
                  size="small"
                  label={activeCount}
                  color="success"
                  icon={<CheckCircleOutlineIcon />}
                />
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography>Администраторы</Typography>
                <Chip
                  size="small"
                  label={adminCount}
                  color="secondary"
                  icon={<SecurityIcon />}
                />
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} mt={1}>
                <Switch
                  size="small"
                  checked={showOnlyActive}
                  onChange={(_, v) => setShowOnlyActive(v)}
                />
                <Typography variant="body2" color="text.secondary">
                  Показывать только активные
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        {user?.is_admin && (
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ p: 2, display: "flex", gap: 1.5 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Рекомендации по безопасности
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Для новых пользователей генерируйте пароль и включайте опцию
                  «Сменить пароль».
                  <br />
                  • Для заблокированных сотрудников используйте флаг «Активен»,
                  чтобы сохранить историю, но запретить вход.
                </Typography>
              </Box>
              <SecurityIcon
                sx={{ fontSize: 48, color: "text.secondary", opacity: 0.4 }}
              />
            </Paper>
          </Grid>
        )}
      </Grid>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <SecurityIcon />
            <Typography variant="h6">Управление доступом</Typography>
          </Stack>
          <Tooltip title="Обновить список">
            <IconButton onClick={() => refetch()} disabled={isFetching || isLoading}>
              {isFetching || isLoading ? (
                <CircularProgress size={20} />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
          </Tooltip>
        </Stack>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Последний вход</TableCell>
                <TableCell align="center">Активен</TableCell>
                <TableCell align="center">Админ</TableCell>
                <TableCell align="center">Сменить пароль</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPyros.map((p) => {
                const isSelf = user && user.id === p.id;
                const pendingThis =
                  flagsUpdateMutation.isPending &&
                  flagsUpdateMutation.variables?.id === p.id;

                return (
                  <TableRow key={p.id} hover sx={{ opacity: p.is_active ? 1 : 0.6 }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>{p.full_name}</Typography>
                        {p.is_admin && (
                          <Chip size="small" label="Админ" color="secondary" variant="outlined" />
                        )}
                        {isSelf && (
                          <Chip size="small" label="Вы" color="primary" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell>
                      {p.last_login_at
                        ? new Date(p.last_login_at).toLocaleString("ru-RU")
                        : "Никогда"}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={p.is_active ? "Отключить вход" : "Разрешить вход"}>
                        <Switch
                          checked={p.is_active}
                          onChange={(_, v) => handleToggleFlag(p, "is_active", v)}
                          color="success"
                          disabled={pendingThis}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={p.is_admin ? "Снять права админа" : "Назначить админом"}>
                        <Switch
                          checked={p.is_admin}
                          onChange={(_, v) => handleToggleFlag(p, "is_admin", v)}
                          color="secondary"
                          disabled={pendingThis || isSelf}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Требовать смену пароля при след. входе">
                        <Switch
                          checked={p.must_change_password}
                          onChange={(_, v) =>
                            handleToggleFlag(p, "must_change_password", v)
                          }
                          color="warning"
                          disabled={pendingThis}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Сбросить и сгенерировать временный пароль">
                        <IconButton onClick={() => handleGeneratePassword(p)}>
                          <VpnKeyIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Временный пароль для пользователя</DialogTitle>
        <DialogContent dividers>
          {passwordDialogUser && (
            <Typography gutterBottom>
              Пользователь: <b>{passwordDialogUser.full_name}</b>
            </Typography>
          )}
          {passwordLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress />
            </Box>
          ) : (
            generatedPassword && (
              <>
                <Typography gutterBottom>
                  Передайте пользователю этот временный пароль. При первом входе
                  система попросит его сменить.
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                  <TextField
                    label="Временный пароль"
                    value={generatedPassword}
                    fullWidth
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                  />
                  <Tooltip title="Скопировать пароль">
                    <IconButton
                      sx={{ ml: 1 }}
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        notifySuccess("Пароль скопирован");
                      }}
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
