// frontend/src/components/PyrotechnicianDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stack,
} from "@mui/material";

import type {
  Pyrotechnician,
  PyrotechnicianCreate,
  PyrotechnicianUpdate,
} from "../types";
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

export default function PyrotechnicianDialog({
  open,
  onClose,
  onSave,
  pyro,
}: Props) {
  const { notifySuccess, notifyError } = useNotification();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!pyro;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [rank, setRank] = useState("");

  useEffect(() => {
    if (open) {
      setFullName(pyro?.full_name ?? "");
      setPhone(pyro?.phone ?? "");
      setEmail(pyro?.email ?? "");
      setRole(pyro?.role ?? "");
      setRank(pyro?.rank ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, pyro]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError("ФИО не может быть пустым.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload: PyrotechnicianCreate | PyrotechnicianUpdate = {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role: role.trim() || undefined,
        rank: rank.trim() || undefined,
      };

      if (isEditing && pyro) {
        await updatePyrotechnician(pyro.id, payload as PyrotechnicianUpdate);
        notifySuccess(`Пиротехник «${payload.full_name}» обновлён`);
      } else {
        await createPyrotechnician(payload as PyrotechnicianCreate);
        notifySuccess(`Пиротехник «${payload.full_name}» создан`);
      }

      onSave();
      onClose();
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ??
        e?.responseData?.detail ??
        e?.message ??
        "Не удалось сохранить данные пиротехника";
      setError(String(detail));
      notifyError(String(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEditing ? "Редактирование пиротехника" : "Новый пиротехник"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="ФИО *"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError(null);
            }}
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="Должность / роль"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="Звание / разряд"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="Телефон"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            disabled={submitting}
          />
          {error && (
            <Box mt={1}>
              <Typography color="error">{error}</Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !fullName.trim()}
        >
          {submitting ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
