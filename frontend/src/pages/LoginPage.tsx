// frontend/src/pages/LoginPage.tsx
import { FormEvent, useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
} from "@mui/material";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../notifications/NotificationProvider";
import { firstChangePassword, login } from "../services/api";

export default function LoginPage() {
  const { setTokenAndUser } = useAuth(); // Предполагается, что в AuthProvider есть такой метод
  const { notifyError, notifySuccess } = useNotification();
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // Используется как временный пароль на втором шаге

  // Состояния для второго шага (смена пароля)
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = location.state?.from?.pathname || "/";

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Введите email и пароль");
      return;
    }

    setLoading(true);
    try {
      const token = await login({ email: email.trim(), password });
      // Обычный успешный вход
      await setTokenAndUser(token.access_token);
      navigate(from, { replace: true });
    } catch (err: any) {
      const status = err?.status;
      const detail = err?.responseData?.detail || err?.message;

      // Ключевая логика: если бэкенд требует смены пароля
      if (status === 403 && detail === "PASSWORD_CHANGE_REQUIRED") {
        setMustChangePassword(true);
        setError("Необходимо сменить временный пароль перед первым входом.");
      } else {
        setError(detail || "Ошибка входа");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstChangeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !newPasswordRepeat) {
      setError("Введите и подтвердите новый пароль");
      return;
    }
    if (newPassword.length < 8) {
      setError("Новый пароль должен быть не менее 8 символов");
      return;
    }
    if (newPassword !== newPasswordRepeat) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const token = await firstChangePassword({
        email: email.trim(),
        temp_password: password,
        new_password: newPassword,
      });

      await setTokenAndUser(token.access_token);
      notifySuccess("Пароль успешно изменён!");
      navigate(from, { replace: true });

    } catch (err: any) {
      const detail = err?.responseData?.detail || err?.message;
      setError(detail || "Ошибка смены пароля");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <LockOpenIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5">
                {mustChangePassword ? "Смена пароля" : "Вход в систему"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mustChangePassword
                  ? "Установите постоянный пароль для входа"
                  : "Введите свои учетные данные"}
              </Typography>
            </Box>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            component="form"
            onSubmit={
              mustChangePassword ? handleFirstChangeSubmit : handleLoginSubmit
            }
          >
            <Stack spacing={2}>
              <TextField
                label="E-mail (логин)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoComplete="username"
                disabled={mustChangePassword || loading}
                required
              />
              <TextField
                label={mustChangePassword ? "Временный пароль" : "Пароль"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete="current-password"
                disabled={loading}
                required
              />

              {mustChangePassword && (
                <>
                  <TextField
                    label="Новый пароль (мин. 8 символов)"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                  <TextField
                    label="Подтвердите новый пароль"
                    type="password"
                    value={newPasswordRepeat}
                    onChange={(e) => setNewPasswordRepeat(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                </>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
              >
                {loading
                  ? "Обработка..."
                  : (mustChangePassword ? "Сменить пароль и войти" : "Войти")}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}