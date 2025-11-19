// frontend/src/components/CreateTeamDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import type { Team, TeamCreate, OrganizationUnit } from "../types";
import { createTeam, fetchTeams } from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

type Props = {
  open: boolean;
  onClose: () => void | Promise<void>;
  onCreated?: () => void | Promise<void>;
  /** Если родительский unit уже известен и селект не нужен */
  parentUnitId?: number | null;

  /** Если нужно показать селект подразделений */
  allUnits?: OrganizationUnit[];
  initialUnitId?: number | null;

  /** Можно прокинуть существующие команды, чтобы не делать отдельный fetch */
  existingTeams?: Team[];
};

function normalizeLight(s: string): string {
  // «лёгкая» нормализация: trim + схлопывание пробелов
  return s.trim().replaceAll(/\s+/g, " ");
}

type CreateResult = {
  team: Team | null;
  isNameConflict: boolean;
  message?: string;
};

export default function CreateTeamDialog({
  open,
  onClose,
  onCreated,
  parentUnitId = null,
  allUnits,
  initialUnitId = null,
  existingTeams,
}: Props) {
  const { notifySuccess, notifyError } = useNotification();

  const [internalOpen, setInternalOpen] = useState<boolean>(open);
  useEffect(() => setInternalOpen(open), [open]);

  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);

  // чтобы знать, пытались ли уже автосуффикс
  const triedAutosuffixRef = useRef(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (existingTeams) {
        setTeams(existingTeams);
        return;
      }
      setFetching(true);
      setError(null);
      try {
        const data = await fetchTeams();
        if (!ignore) setTeams(data);
      } catch (e: any) {
        if (!ignore)
          setError(e?.message || "Не удалось загрузить список групп");
      } finally {
        if (!ignore) setFetching(false);
      }
    }

    if (internalOpen) {
      setName("");
      setError(null);
      triedAutosuffixRef.current = false;
      const start = parentUnitId ?? initialUnitId ?? null;
      setUnitId(start ?? "");
      load();
    }

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalOpen]);

  const normalizedExistingByUnit = useMemo(() => {
    const map = new Map<number | "no-unit", Set<string>>();
    for (const t of teams) {
      const key = (t.organization_unit_id ?? "no-unit") as number | "no-unit";
      const set = map.get(key) ?? new Set<string>();
      set.add(normalizeLight(t.name));
      map.set(key, set);
    }
    return map;
  }, [teams]);

  const resolveUnitId = (): number | null => {
    if (Array.isArray(allUnits) && allUnits.length > 0) {
      if (unitId === "") return null;
      return Number(unitId);
    }
    return parentUnitId ?? null;
  };

  const closeSafely = () => {
    setInternalOpen(false);
    try {
      onClose?.();
    } catch {
      /* ignore */
    }
  };

  async function tryCreate(payload: TeamCreate): Promise<CreateResult> {
    try {
      setError(null);
      const team = await createTeam(payload);
      return { team, isNameConflict: false };
    } catch (e: any) {
      console.error(e);
      const status = e?.status ?? e?.response?.status;
      const detail =
        e?.responseData?.detail ??
        e?.response?.data?.detail ??
        e?.message ??
        "";

      const message = detail || "Не удалось создать группу";
      const errorMessage = `Ошибка: ${message}`;
      setError(errorMessage);

      const isNameConflict =
        status === 409 || /существует|exists|is taken/i.test(String(detail));

      return { team: null, isNameConflict, message };
    }
  }

  async function handleSubmit() {
    const finalUnitId = resolveUnitId();
    const baseName = normalizeLight(name);

    if (!baseName) {
      setError("Введите название группы.");
      return;
    }

    const unitKey = (finalUnitId ?? "no-unit") as number | "no-unit";
    const existingSet =
      normalizedExistingByUnit.get(unitKey) ?? new Set<string>();

    if (existingSet.has(baseName)) {
      setError("Группа с таким названием уже существует в этом подразделении.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) Прямая попытка
      const payload: TeamCreate = {
        name: baseName,
        organization_unit_id: finalUnitId,
      };
      const { team, isNameConflict, message } = await tryCreate(payload);

      if (team) {
        if (typeof onCreated === "function") {
          try {
            await onCreated();
          } catch {
            /* ignore */
          }
        }
        notifySuccess(`Группа «${team.name}» успешно создана`);
        closeSafely();
        return;
      }

      // 2) Конфликт названия — пробуем авто-суффикс, если ещё не пробовали
      if (isNameConflict && !triedAutosuffixRef.current) {
        triedAutosuffixRef.current = true;

        for (let i = 2; i <= 10; i++) {
          const candidate = `${baseName} (${i})`;
          if (!existingSet.has(candidate)) {
            const { team: suffixedTeam } = await tryCreate({
              name: candidate,
              organization_unit_id: finalUnitId,
            });
            if (suffixedTeam) {
              if (typeof onCreated === "function") {
                try {
                  await onCreated();
                } catch {
                  /* ignore */
                }
              }
              notifySuccess(
                `Группа «${baseName}» уже существует. Создана «${suffixedTeam.name}».`
              );
              closeSafely();
              return;
            }
          }
        }
      }

      // 3) Если сюда дошли — значит, так и не смогли создать
      if (message) {
        notifyError(message);
      } else {
        notifyError("Не удалось создать группу");
      }
    } finally {
      setLoading(false);
    }
  }

  const showUnitSelect = Array.isArray(allUnits) && allUnits.length > 0;

  return (
    <Dialog open={internalOpen} onClose={closeSafely} fullWidth maxWidth="sm">
      <DialogTitle>Новая группа</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Название группы *"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            disabled={loading || fetching}
            autoFocus
            fullWidth
            helperText="Название должно быть уникальным в рамках выбранного подразделения"
          />

          {showUnitSelect && (
            <FormControl fullWidth disabled={loading || fetching}>
              <InputLabel id="unit-select-label">Подразделение</InputLabel>
              <Select
                labelId="unit-select-label"
                label="Подразделение"
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value as number | "");
                  setError(null);
                }}
              >
                <MenuItem value="">
                  <em>Без подразделения</em>
                </MenuItem>
                {allUnits!.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={closeSafely} disabled={loading}>
          Отмена
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || fetching || !name.trim()}
        >
          {loading ? "Создание..." : "Создать"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
