// src/components/ConfirmDeleteUnitDialog.tsx
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Typography,
  TextField,
  Stack,
} from "@mui/material";

export type DeleteMode = "single" | "cascade";

export default function ConfirmDeleteUnitDialog({
  open,
  unitName,
  onClose,
  onConfirm,
  defaultMode = "single",
  requireTyping = true,
}: {
  open: boolean;
  unitName: string;
  onClose: () => void;
  onConfirm: (mode: DeleteMode) => void;
  /** какой режим выбран по умолчанию */
  defaultMode?: DeleteMode;
  /** нужно ли требовать ввод контрольной фразы */
  requireTyping?: boolean;
}) {
  const [mode, setMode] = useState<DeleteMode>(defaultMode);
  const [text, setText] = useState("");

  // контрольная фраза зависит от режима
  const passphrase = useMemo(
    () => (mode === "cascade" ? "удалить всё" : "удалить"),
    [mode]
  );

  const canConfirm = requireTyping ? text.trim().toLowerCase() === passphrase : true;

  const handleClose = () => {
    setText("");
    setMode(defaultMode);
    onClose();
  };

  const handleConfirm = () => {
    setText("");
    onConfirm(mode);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Удаление подразделения</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography>
            Вы пытаетесь удалить подразделение <b>«{unitName}»</b>.
          </Typography>

          <Alert severity="warning">
            Действие необратимо. Если выбрать удаление со всем содержимым —
            будут удалены дочерние подразделения, команды и связи сотрудников.
          </Alert>

          <RadioGroup
            value={mode}
            onChange={(_, v) => setMode((v as DeleteMode) ?? "single")}
          >
            <FormControlLabel
              value="single"
              control={<Radio />}
              label="Удалить только это подразделение (если оно пустое)"
            />
            <FormControlLabel
              value="cascade"
              control={<Radio />}
              label="Удалить подразделение вместе со всем содержимым"
            />
          </RadioGroup>

          {requireTyping && (
            <>
              <Typography variant="body2" color="text.secondary">
                Для подтверждения введите фразу:{" "}
                <b>{passphrase}</b>
              </Typography>
              <TextField
                autoFocus
                fullWidth
                size="small"
                label="Подтверждение"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={passphrase}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Отмена</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={mode === "cascade" ? "error" : "primary"}
          disabled={!canConfirm}
        >
          {mode === "cascade" ? "Удалить всё" : "Удалить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
