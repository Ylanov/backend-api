// frontend/src/components/EditTeamDialog.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import type { Pyrotechnician, Team, TeamUpdate, OrganizationUnit } from "../types";
import { fetchPyrotechnicians, updateTeam } from "../services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void; // Вызывается после успешного обновления
  team: Team | null; // Команда для редактирования
  allUnits: OrganizationUnit[]; // Список всех подразделений для выбора
};

export default function EditTeamDialog({ open, onClose, onUpdated, team, allUnits }: Props) {
  const [name, setName] = useState("");
  const [lead, setLead] = useState<Pyrotechnician | null>(null);
  const [members, setMembers] = useState<Pyrotechnician[]>([]);
  const [unitId, setUnitId] = useState<number | string>("");

  const [pyros, setPyros] = useState<Pyrotechnician[]>([]);
  const [loadingPyros, setLoadingPyros] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Подгрузка списка пиротехников при открытии
  useEffect(() => {
    if (!open) return;
    const loadPyros = async () => {
      setLoadingPyros(true);
      try {
        const list = await fetchPyrotechnicians();
        setPyros(Array.isArray(list) ? list : []);
      } catch (e) {
        setError("Не удалось загрузить список пиротехников.");
      } finally {
        setLoadingPyros(false);
      }
    };
    loadPyros();
  }, [open]);

  // Заполнение формы данными команды при ее изменении или открытии диалога
  useEffect(() => {
    if (team && open) {
      setName(team.name || "");
      setLead(team.lead ?? null);
      setMembers(team.members?.filter(Boolean) as Pyrotechnician[] ?? []);
      setUnitId(team.organization_unit_id || "");
    }
    // Сбрасываем ошибку при каждом открытии
    if (open) {
        setError(null);
    }
  }, [team, open]);

  const options = useMemo(() => pyros ?? [], [pyros]);
  const isValid = name.trim().length > 0 && !!team;

  const onSubmit = async () => {
    if (!isValid) return;

    try {
      setSubmitting(true);
      setError(null);
      const payload: TeamUpdate = {
        name: name.trim(),
        lead_id: lead?.id ?? null,
        member_ids: members.map((m) => m.id),
        organization_unit_id: unitId ? Number(unitId) : null,
      };
      await updateTeam(team.id, payload);
      onClose();
      onUpdated(); // Сообщаем родительскому компоненту об успехе
    } catch (e: any) {
      const detail = e.response?.data?.detail || e.message;
      console.error(e);
      setError(`Не удалось обновить команду: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Редактировать команду</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} mt={1}>
          <TextField
            label="Название команды"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            fullWidth
            required
            disabled={submitting}
          />

          {Array.isArray(allUnits) && (
            <FormControl fullWidth disabled={submitting}>
              <InputLabel id="edit-unit-select-label">Подразделение (необязательно)</InputLabel>
              <Select
                labelId="edit-unit-select-label"
                value={unitId}
                label="Подразделение (необязательно)"
                onChange={(e) => setUnitId(e.target.value)}
              >
                <MenuItem value="">
                  <em>Без подразделения</em>
                </MenuItem>
                {allUnits.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Autocomplete
            options={options}
            loading={loadingPyros}
            value={lead}
            onChange={(_, val) => setLead(val)}
            getOptionLabel={(o) => o?.full_name ?? ""}
            isOptionEqualToValue={(a, b) => a?.id === b?.id}
            renderInput={(params) => <TextField {...params} label="Руководитель (необязательно)" disabled={submitting}/>}
          />

          <Autocomplete
            multiple
            options={options}
            loading={loadingPyros}
            value={members}
            onChange={(_, val) => setMembers(val)}
            getOptionLabel={(o) => o?.full_name ?? ""}
            isOptionEqualToValue={(a, b) => a?.id === b?.id}
            renderInput={(params) => <TextField {...params} label="Участники" placeholder="Начните вводить ФИО…" disabled={submitting}/>}
          />

          {error && (
            <Box><Typography color="error" variant="body2">{error}</Typography></Box>
          )}

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Отмена</Button>
        <Button variant="contained" onClick={onSubmit} disabled={!isValid || submitting}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}