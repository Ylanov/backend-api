// frontend/src/components/PyrotechnicianForm.tsx
import { useState } from "react";
import type { PyrotechnicianCreate } from "../types";
import {
  TextField,
  Button,
  Grid,
  CircularProgress,
  Typography,
  Paper,
} from "@mui/material";

type Props = {
  onCreate: (payload: PyrotechnicianCreate) => Promise<void>;
};

export default function PyrotechnicianForm({ onCreate }: Props) {
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [rating, setRating] = useState<string>(""); // храним как строку, отправим числом или undefined
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Укажите ФИО");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const payload: PyrotechnicianCreate = {
      full_name: fullName.trim(),
      phone: phone.trim() || undefined, // более компактная запись
      email: email.trim() || undefined,
      // Убедитесь, что добавили rating?: number в types.ts
      rating: rating.trim() ? Number(rating) : undefined,

      // Обязательные поля для создания пользователя
      is_admin: false,
      is_active: true,
    };

    try {
      await onCreate(payload);
      setFullName("");
      setPhone("");
      setEmail("");
      setRating("");
    } catch {
      setError("Не удалось добавить пиротехника");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Добавить нового пиротехника
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="ФИО *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            fullWidth
            required
            disabled={isSubmitting}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Телефон"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            disabled={isSubmitting}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            disabled={isSubmitting}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Рейтинг"
            type="number"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            fullWidth
            disabled={isSubmitting}
            inputProps={{ min: 0, step: 1 }}
          />
        </Grid>

        {error && (
          <Grid item xs={12}>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </Grid>
        )}

        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? <CircularProgress size={20} color="inherit" /> : null
            }
          >
            {isSubmitting ? "Добавление..." : "Добавить"}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}
