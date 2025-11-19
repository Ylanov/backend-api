import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  OrganizationUnit,
  OrganizationUnitCreate,
  OrganizationUnitUpdate,
  OrganizationNode,
} from "../types";
import { createOrganizationUnit, updateOrganizationUnit } from "../services/api";

type Props = {
  open: boolean;
  /** Вызывается при закрытии (необязательно меняет флаг в родителе). */
  onClose: () => void;
  /** Сообщаем, что данные изменились (родитель может перезагрузить). */
  onSave: () => void;
  /** Если редактирование — сюда приходит юнит; если создание — null. */
  unit: Partial<OrganizationUnit> | Partial<OrganizationNode> | null;
  /** Родитель для нового подразделения. */
  parentId: number | null;
};

function toNumericUnitId(src: Props["unit"]): number | null {
  if (!src?.id) return null;
  if (typeof src.id === "number") return src.id;
  const s = String(src.id);
  if (s.startsWith("unit-")) {
    const n = Number.parseInt(s.slice(5), 10);
    return Number.isNaN(n) ? null : n;
  }
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

export default function UnitDialog({ open, onClose, onSave, unit, parentId }: Props) {
  const [internalOpen, setInternalOpen] = useState<boolean>(open);
  useEffect(() => setInternalOpen(open), [open]);

  const unitId = useMemo(() => toNumericUnitId(unit), [unit]);
  const isEditing = unitId != null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (internalOpen) {
      setName((unit as OrganizationUnit)?.name ?? unit?.name ?? "");
      setDescription((unit as OrganizationUnit)?.description ?? unit?.description ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [internalOpen, unit]);

  const closeSafely = () => {
    setInternalOpen(false); // закрываем сами
    try {
      onClose?.();          // уведомляем родителя (если он изменит свой open — синхронизируемся эффектом)
    } catch {
      // игнор
    }
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Название не может быть пустым.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isEditing) {
        const payload: OrganizationUnitUpdate = {
          name: trimmed,
          description: description.trim() ? description.trim() : null,
        };
        await updateOrganizationUnit(unitId!, payload);
      } else {
        const payload: OrganizationUnitCreate = {
          name: trimmed,
          description: description.trim() ? description.trim() : null,
          parent_id: parentId ?? null,
        };
        await createOrganizationUnit(payload);
      }
      try {
        onSave?.();
      } finally {
        closeSafely();
      }
    } catch (e: any) {
      setError(e?.message ?? "Не удалось сохранить изменения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={internalOpen}
      onClose={closeSafely}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{isEditing ? "Редактировать подразделение" : "Новое подразделение"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Название *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            fullWidth
            required
            disabled={submitting}
          />
          <TextField
            label="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
            disabled={submitting}
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={closeSafely} disabled={submitting}>
          Отмена
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !name.trim()}
        >
          {submitting ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
