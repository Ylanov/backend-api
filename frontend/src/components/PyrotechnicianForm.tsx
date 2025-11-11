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
      phone: phone.trim() ? phone.trim() : undefined,
      email: email.trim() ? email.trim() : undefined,
      rating: rating.trim() ? Number(rating) : undefined,
    };

    try {
      await onCreate(payload);
      // Сброс формы в случае успеха
      setFullName("");
      setPhone("");
      setEmail("");
      setRating("");
    } catch {
      // Ошибку показываем здесь минимально; основная обработка может быть выше
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
