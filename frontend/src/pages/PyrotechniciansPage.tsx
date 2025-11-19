// frontend/src/pages/PyrotechniciansPage.tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Box,
  Grid,
  TextField,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  FormControlLabel,
  Switch,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";

import type { Pyrotechnician } from "../types";
import {
  createPyrotechnician,
  updatePyrotechnician,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  pyro: Pyrotechnician | null;
};

// Безопасная и простая проверка e-mail без вложенных квантификаторов
// и с ограничением максимальной длины — чтобы исключить риск ReDoS.
const MAX_EMAIL_LENGTH = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PyrotechnicianDialog({
  open,
  onClose,
  onSave,
  pyro,
}: Props) {
  const { notifySuccess, notifyError } = useNotification();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [rank, setRank] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Заполняем форму при открытии диалога
  useEffect(() => {
    if (!open) return;

    if (pyro) {
      setFullName(pyro.full_name ?? "");
      setPhone(pyro.phone ?? "");
      setEmail(pyro.email ?? "");
      setRole(pyro.role ?? "");
      setRank(pyro.rank ?? "");
      // Если в типе пока нет флагов — будут undefined, поэтому приводим к значениям по умолчанию
      setIsActive((pyro as any).is_active ?? true);
      setIsAdmin((pyro as any).is_admin ?? false);
    } else {
      setFullName("");
      setPhone("");
      setEmail("");
      setRole("");
      setRank("");
      setIsActive(true);
      setIsAdmin(false);
    }
    setError(null);
  }, [open, pyro]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const validate = () => {
    if (!fullName.trim()) {
      setError("ФИО обязательно.");
      return false;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("E-mail обязателен.");
      return false;
    }

    // Ограничиваем длину и используем простой безопасный паттерн —
    // без вложенных квантификаторов, чтобы избежать потенциального ReDoS.
    if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      setError("E-mail слишком длинный.");
      return false;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Укажите корректный e-mail.");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError(null);

    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim(),
      role: role.trim() || null,
      rank: rank.trim() || null,
      // Эти поля должны быть добавлены в PyrotechnicianCreate / PyrotechnicianUpdate на бэке
      is_active: isActive,
      is_admin: isAdmin,
    };

    try {
      if (pyro) {
        await updatePyrotechnician(pyro.id, payload as any);
        notifySuccess(`Пиротехник «${payload.full_name}» обновлён.`);
      } else {
        await createPyrotechnician(payload as any);
        notifySuccess(`Пиротехник «${payload.full_name}» создан.`);
      }
      setLoading(false);
      onSave();
    } catch (errorAny: any) {
      const msg =
        errorAny?.response?.data?.detail ||
        errorAny?.message ||
        "Не удалось сохранить пиротехника.";
      setError(msg);
      notifyError(msg);
      setLoading(false);
    }
  };

  return (
    <Dialog fullScreen open={open} onClose={handleClose}>
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleClose}
            disabled={loading}
          >
            <CloseIcon />
          </IconButton>

          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            {pyro ? "Редактирование пиротехника" : "Новый пиротехник"}
          </Typography>

          <Button
            color="inherit"
            onClick={handleSubmit}
            disabled={loading}
            startIcon={<PersonIcon />}
          >
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, mt: 2 }}>
        <Grid container spacing={2} justifyContent="center">
          <Grid item xs={12} md={6} lg={5}>
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  Основная информация
                </Typography>

                {error && <Alert severity="error">{error}</Alert>}

                <TextField
                  label="ФИО"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  fullWidth
                  required
                />

                <TextField
                  label="E-mail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  fullWidth
                  required
                  type="email"
                />

                <TextField
                  label="Телефон"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  fullWidth
                />

                <TextField
                  label="Роль"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  fullWidth
                />

                <TextField
                  label="Звание"
                  value={rank}
                  onChange={(event) => setRank(event.target.value)}
                  fullWidth
                />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Статусы
                  </Typography>
                  <Stack direction="row" spacing={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isActive}
                          onChange={(event) =>
                            setIsActive(event.target.checked)
                          }
                        />
                      }
                      label="Активен"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isAdmin}
                          onChange={(event) =>
                            setIsAdmin(event.target.checked)
                          }
                        />
                      }
                      label="Администратор"
                    />
                  </Stack>
                </Box>

                {loading && (
                  <Box sx={{ textAlign: "center", mt: 1 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Dialog>
  );
}
