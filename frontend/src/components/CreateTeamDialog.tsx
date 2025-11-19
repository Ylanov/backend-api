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

function normalizeLight(source: string): string {
  // «лёгкая» нормализация: trim + схлопывание пробелов
  return source.trim().replaceAll(/\s+/g, " ");
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
        if (!ignore) {
          setTeams(data);
        }
      } catch (error_: any) {
        if (!ignore) {
          setError(error_?.message || "Не удалось загрузить список групп");
        }
      } finally {
        if (!ignore) {
          setFetching(false);
        }
      }
    }

    if (internalOpen) {
      setName("");
      setError(null);
      triedAutosuffixRef.current = false;
      const startUnitId = parentUnitId ?? initialUnitId ?? null;
      setUnitId(startUnitId ?? "");
      load();
    }

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalOpen]);

  const normalizedExistingByUnit = useMemo(() => {
    const map = new Map<number | "no-unit", Set<string>>();
    for (const team of teams) {
      const unitKey = (team.organization_unit_id ?? "no-unit") as
        | number
        | "no-unit";
      const set =
        map.get(unitKey) ??
        new Set<string>();
      set.add(normalizeLight(team.name));
      map.set(unitKey, set);
    }
    return map;
  }, [teams]);

  const resolveUnitId = (): number | null => {
    if (Array.isArray(allUnits) && allUnits.length > 0) {
      if (unitId === "") {
        return null;
      }
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
    } catch (error_: any) {
      console.error(error_);
      const status = error_?.status ?? error_?.response?.status;
      const detail =
        error_?.responseData?.detail ??
        error_?.response?.data?.detail ??
        error_?.message ??
        "";

      const message = detail || "Не удалось создать группу";
      const errorMessage = `Ошибка: ${message}`;
      setError(errorMessage);

      const isNameConflict =
        status === 409 ||
        /существует|exists|is taken/i.test(String(detail));

      return { team: null, isNameConflict, message };
    }
  }

  const getExistingNamesSetForUnit = (
    finalUnitId: number | null
  ): Set<string> => {
    const unitKey = (finalUnitId ?? "no-unit") as number | "no-unit";
    return normalizedExistingByUnit.get(unitKey) ?? new Set<string>();
  };

  const isBaseNameValid = (
    baseName: string,
    existingSet: Set<string>
  ): boolean => {
    if (!baseName) {
      setError("Введите название группы.");
      return false;
    }
    if (existingSet.has(baseName)) {
      setError(
        "Группа с таким названием уже существует в этом подразделении."
      );
      return false;
    }
    return true;
  };

  const runOnCreatedCallbackSafely = async () => {
    if (typeof onCreated === "function") {
      try {
        await onCreated();
      } catch {
        /* ignore */
      }
    }
  };

  const notifyCreationAndClose = async (
    createdTeam: Team,
    baseName: string,
    wasAutosuffixed: boolean
  ) => {
    await runOnCreatedCallbackSafely();
    if (wasAutosuffixed) {
      notifySuccess(
        `Группа «${baseName}» уже существует. Создана «${createdTeam.name}».`
      );
    } else {
      notifySuccess(`Группа «${createdTeam.name}» успешно создана`);
    }
    closeSafely();
  };

  const handleFinalErrorNotification = (message?: string) => {
    if (message) {
      notifyError(message);
    } else {
      notifyError("Не удалось создать группу");
    }
  };

  const attemptDirectCreation = async (
    baseName: string,
    finalUnitId: number | null
  ): Promise<CreateResult> => {
    const payload: TeamCreate = {
      name: baseName,
      organization_unit_id: finalUnitId,
    };
    return tryCreate(payload);
  };

  const attemptAutosuffixCreation = async (
    baseName: string,
    finalUnitId: number | null,
    existingSet: Set<string>
  ): Promise<Team | null> => {
    triedAutosuffixRef.current = true;

    for (let suffixNumber = 2; suffixNumber <= 10; suffixNumber++) {
      const candidateName = `${baseName} (${suffixNumber})`;
      if (existingSet.has(candidateName)) {
        continue;
      }

      const { team: suffixedTeam } = await tryCreate({
        name: candidateName,
        organization_unit_id: finalUnitId,
      });

      if (suffixedTeam) {
        return suffixedTeam;
      }
    }

    return null;
  };

  async function handleSubmit() {
    const finalUnitId = resolveUnitId();
    const baseName = normalizeLight(name);
    const existingSet = getExistingNamesSetForUnit(finalUnitId);

    if (!isBaseNameValid(baseName, existingSet)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        team,
        isNameConflict,
        message,
      } = await attemptDirectCreation(baseName, finalUnitId);

      if (team) {
        await notifyCreationAndClose(team, baseName, false);
        return;
      }

      if (isNameConflict && !triedAutosuffixRef.current) {
        const suffixedTeam = await attemptAutosuffixCreation(
          baseName,
          finalUnitId,
          existingSet
        );

        if (suffixedTeam) {
          await notifyCreationAndClose(suffixedTeam, baseName, true);
          return;
        }
      }

      handleFinalErrorNotification(message);
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
            onChange={(event) => {
              setName(event.target.value);
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
                onChange={(event) => {
                  setUnitId(event.target.value as number | "");
                  setError(null);
                }}
              >
                <MenuItem value="">
                  <em>Без подразделения</em>
                </MenuItem>
                {allUnits!.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    {unit.name}
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
