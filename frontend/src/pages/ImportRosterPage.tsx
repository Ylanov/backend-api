// frontend/src/pages/ImportRosterPage.tsx
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PreviewIcon from "@mui/icons-material/Preview";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import {
  createOrganizationUnit,
  createPyrotechnician,
  createTeam,
  patchTeam,
  fetchOrganizationUnits,
  fetchPyrotechnicians,
  fetchTeams,
  isCanceled,
} from "../services/api";
import type {
  OrganizationUnit,
  PyrotechnicianCreate,
  Team,
} from "../types";

// --- Типы и утилиты ---

type RawRow = Record<string, any>;

type Mapping = {
  parentUnit: string | null;
  unit: string | null;
  team: string | null;
  fullName: string | null;
  role: string | null;
  rank: string | null;
  phone: string | null;
  email: string | null;
};

type NormalizedRow = {
  parentUnit: string | null;
  unit: string;
  team: string;
  fullName: string;
  role: string | null;
  rank: string | null;
  phone: string | null;
  email: string | null;
};

type DryRunResult = {
  unitsToCreate: { parent: string | null; name: string }[];
  teamsToCreate: { unit: string; team: string }[];
  pyrosToCreate: NormalizedRow[];
};

type UnitPair = { parent: string | null; name: string };

type ImportMaps = {
  unitsById: Map<number, OrganizationUnit>;
  unitNameToId: Map<string, number>;
  teamByKey: Map<string, Team>;
  pyroNameToId: Map<string, number>;
};

const norm = (value: any): string =>
  (value ?? "").toString().trim();

const normKey = (value: string): string =>
  norm(value).toLowerCase();

const stringsRow = (row: any[]): string[] =>
  row.map((cell) => norm(cell));

const uniqHeaders = (headers: string[]): string[] => {
  const used = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header || `col_${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
};

const mappingLabels: Record<keyof Mapping, string> = {
  parentUnit: "Родительское подразделение",
  unit: "Подразделение / отдел",
  team: "Команда / группа",
  fullName: "ФИО",
  role: "Должность",
  rank: "Звание",
  phone: "Телефон",
  email: "E-mail",
};

// --- Вспомогательные функции для нормализации строк ---

function resolveParentUnitForRow(
  currentParentUnit: string | null,
  row: RawRow,
  mapping: Mapping
): { parentUnit: string | null; nextParentUnit: string | null } {
  if (!mapping.parentUnit) {
    return { parentUnit: null, nextParentUnit: currentParentUnit };
  }

  const rawParent = norm(row[mapping.parentUnit]);
  if (rawParent) {
    return { parentUnit: rawParent, nextParentUnit: rawParent };
  }

  return { parentUnit: currentParentUnit, nextParentUnit: currentParentUnit };
}

function resolveUnitForRow(
  currentUnit: string | null,
  row: RawRow,
  mapping: Mapping
): { unit: string; nextUnit: string | null } {
  const rawUnit = mapping.unit ? norm(row[mapping.unit]) : "";
  if (rawUnit) {
    return { unit: rawUnit, nextUnit: rawUnit };
  }

  const finalUnit = currentUnit || rawUnit || "Без подразделения";
  return { unit: finalUnit, nextUnit: currentUnit };
}

function resolveTeamForRow(
  currentTeam: string | null,
  row: RawRow,
  mapping: Mapping
): { team: string; nextTeam: string | null } {
  if (!mapping.team) {
    return { team: "Без группы", nextTeam: currentTeam };
  }

  const rawTeam = norm(row[mapping.team]);
  if (rawTeam) {
    return { team: rawTeam, nextTeam: rawTeam };
  }

  const finalTeam = currentTeam || rawTeam || "Без группы";
  return { team: finalTeam, nextTeam: currentTeam };
}

function buildNormalizedRows(
  sheetRows: RawRow[],
  mapping: Mapping
): NormalizedRow[] {
  if (!sheetRows.length || !mapping.unit || !mapping.fullName) {
    return [];
  }

  let currentParentUnit: string | null = null;
  let currentUnit: string | null = null;
  let currentTeam: string | null = null;

  const result: NormalizedRow[] = [];

  for (const row of sheetRows) {
    const fullName = norm(row[mapping.fullName]);
    if (!fullName) {
      continue;
    }

    const parentResult = resolveParentUnitForRow(
      currentParentUnit,
      row,
      mapping
    );
    currentParentUnit = parentResult.nextParentUnit;

    const unitResult = resolveUnitForRow(currentUnit, row, mapping);
    currentUnit = unitResult.nextUnit;

    const teamResult = resolveTeamForRow(currentTeam, row, mapping);
    currentTeam = teamResult.nextTeam;

    result.push({
      parentUnit: parentResult.parentUnit,
      unit: unitResult.unit,
      team: teamResult.team,
      fullName,
      role: mapping.role ? norm(row[mapping.role]) || null : null,
      rank: mapping.rank ? norm(row[mapping.rank]) || null : null,
      phone: mapping.phone ? norm(row[mapping.phone]) || null : null,
      email: mapping.email ? norm(row[mapping.email]) || null : null,
    });
  }

  return result;
}

// --- Вспомогательные функции для импорта ---

function buildImportMaps(
  units: OrganizationUnit[],
  teams: Team[],
  pyros: { id: number; full_name: string }[]
): ImportMaps {
  const unitsById = new Map<number, OrganizationUnit>();
  for (const unit of units) {
    unitsById.set(unit.id, unit);
  }

  const unitNameToId = new Map<string, number>();
  for (const unit of units) {
    unitNameToId.set(normKey(unit.name), unit.id);
  }

  const teamByKey = new Map<string, Team>();
  for (const team of teams) {
    const unitId = team.organization_unit_id ?? 0;
    const key = `${unitId}::${normKey(team.name)}`;
    teamByKey.set(key, team);
  }

  const pyroNameToId = new Map<string, number>();
  for (const pyro of pyros) {
    pyroNameToId.set(normKey(pyro.full_name), pyro.id);
  }

  return { unitsById, unitNameToId, teamByKey, pyroNameToId };
}

function collectUnitPairs(rows: NormalizedRow[]): UnitPair[] {
  const unitPairsMap = new Map<string, UnitPair>();
  for (const row of rows) {
    const key = `${row.parentUnit ?? ""}::${row.unit}`;
    if (!unitPairsMap.has(key)) {
      unitPairsMap.set(key, { parent: row.parentUnit, name: row.unit });
    }
  }
  return Array.from(unitPairsMap.values());
}

function collectUniquePyroNames(rows: NormalizedRow[]): Set<string> {
  const uniqueNames = new Set<string>();
  for (const row of rows) {
    uniqueNames.add(normKey(row.fullName));
  }
  return uniqueNames;
}

function collectTeamGroupKeys(rows: NormalizedRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(`${row.unit}::${row.team}`);
  }
  return keys;
}

function createUnitKeyWithParent(
  parentName: string | null,
  name: string
): string {
  const parent = parentName ? normKey(parentName) : "root";
  return `${parent}::${normKey(name)}`;
}

async function createMissingUnitsWithParents(
  unitPairs: UnitPair[],
  importMaps: ImportMaps,
  addLog: (line: string) => void,
  incrementProgress: () => void
): Promise<void> {
  const { unitsById, unitNameToId } = importMaps;

  const pendingUnits = unitPairs.filter(
    (pair) => !unitNameToId.has(normKey(pair.name))
  );

  let safety = 0;

  while (pendingUnits.length && safety < 1000) {
    safety += 1;
    let progressed = false;

    for (let index = pendingUnits.length - 1; index >= 0; index--) {
      const pending = pendingUnits[index];
      const nameKey = normKey(pending.name);

      if (unitNameToId.has(nameKey)) {
        pendingUnits.splice(index, 1);
        continue;
      }

      // Оптимизация: сразу пытаемся найти ID родителя
      const parentIdFound = pending.parent
        ? unitNameToId.get(normKey(pending.parent))
        : null;

      // Если родитель задан, но его ID нет в карте, значит родитель еще не создан -> пропускаем
      if (pending.parent && parentIdFound === undefined) {
        continue;
      }

      const parentId = parentIdFound ?? null;

      const created = await createOrganizationUnit({
        name: pending.name,
        parent_id: parentId,
        description: null,
      } as any);

      unitNameToId.set(nameKey, created.id);
      unitsById.set(created.id, created);

      incrementProgress();
      addLog(
        `Создано подразделение "${pending.name}" (родитель: ${
          pending.parent ?? "—"
        })`
      );

      pendingUnits.splice(index, 1);
      progressed = true;
    }

    if (!progressed) {
      break;
    }
  }
}

async function createMissingPyrotechniciansForRows(
  rows: NormalizedRow[],
  pyroNameToId: Map<string, number>,
  addLog: (line: string) => void,
  incrementProgress: () => void
): Promise<void> {
  for (const row of rows) {
    const key = normKey(row.fullName);
    if (pyroNameToId.has(key)) {
      continue;
    }

    const payload: PyrotechnicianCreate = {
      full_name: row.fullName,
      phone: row.phone || undefined,
      email: row.email || undefined,
      role: row.role || undefined,
      rank: row.rank || undefined,
      is_admin: false,
      is_active: true,
    };

    const created = await createPyrotechnician(payload);
    pyroNameToId.set(key, created.id);

    incrementProgress();
    addLog(`Создан сотрудник "${row.fullName}"`);
  }
}

type GroupedRows = {
  unitName: string;
  teamName: string;
  rows: NormalizedRow[];
};

function groupRowsByUnitAndTeam(
  rows: NormalizedRow[]
): Map<string, GroupedRows> {
  const groups = new Map<string, GroupedRows>();

  for (const row of rows) {
    const key = `${row.unit}::${row.team}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        unitName: row.unit,
        teamName: row.team,
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  return groups;
}

async function syncTeamsForGroups(
  rows: NormalizedRow[],
  importMaps: ImportMaps,
  addLog: (line: string) => void,
  incrementProgress: () => void
): Promise<void> {
  const { unitNameToId, teamByKey, pyroNameToId } = importMaps;
  const groups = groupRowsByUnitAndTeam(rows);

  for (const [, group] of groups) {
    const unitId = unitNameToId.get(normKey(group.unitName));
    if (!unitId) {
      addLog(
        `⚠ Не найдено подразделение "${group.unitName}" для команды "${group.teamName}"`
      );
      continue;
    }

    const memberIds: number[] = [];
    for (const row of group.rows) {
      const pyroId = pyroNameToId.get(normKey(row.fullName));
      if (pyroId) {
        memberIds.push(pyroId);
      }
    }

    const teamKey = `${unitId}::${normKey(group.teamName)}`;
    const existingTeam = teamByKey.get(teamKey);

    if (existingTeam) {
      await patchTeam(existingTeam.id, { member_ids: memberIds });
      addLog(
        `Обновлена команда "${group.teamName}" в подразделении "${group.unitName}" (${memberIds.length} сотрудников)`
      );
    } else {
      await createTeam({
        name: group.teamName,
        organization_unit_id: unitId,
        member_ids: memberIds,
      });
      addLog(
        `Создана команда "${group.teamName}" в подразделении "${group.unitName}" (${memberIds.length} сотрудников)`
      );
    }

    incrementProgress();
  }
}

// Функция для выноса логики сбора существующих ключей, чтобы снизить сложность runDryRun
function buildExistingSetsForDryRun(
  units: OrganizationUnit[],
  teams: Team[],
  pyros: { full_name: string }[],
  unitsById: Map<number, OrganizationUnit>
) {
  const unitKey = (parentName: string | null, name: string) =>
    createUnitKeyWithParent(parentName, name);

  const existingUnitKeys = new Set<string>();
  for (const unit of units) {
    // Исправлено условие с отрицанием (unit.parent_id != null)
    const parentName =
      unit.parent_id == null
        ? null
        : unitsById.get(unit.parent_id)?.name ?? null;
    existingUnitKeys.add(unitKey(parentName, unit.name));
  }

  const existingTeamKeys = new Set<string>();
  for (const team of teams) {
    const unitId = team.organization_unit_id ?? 0;
    existingTeamKeys.add(`${unitId}::${normKey(team.name)}`);
  }

  const existingPyroNames = new Set<string>();
  for (const pyro of pyros) {
    existingPyroNames.add(normKey(pyro.full_name));
  }

  return { existingUnitKeys, existingTeamKeys, existingPyroNames, unitKey };
}

// --- Компонент страницы импорта ---

export default function ImportRosterPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({
    parentUnit: null,
    unit: null,
    team: null,
    fullName: null,
    role: null,
    rank: null,
    phone: null,
    email: null,
  });

  const [parseError, setParseError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [loadingDryRun, setLoadingDryRun] = useState(false);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importLog, setImportLog] = useState<string[]>([]);

  // --- Нормализация строк (fill-down логика по подразделениям и группам) ---

  const normalizedRows: NormalizedRow[] = useMemo(
    () => buildNormalizedRows(sheetRows, mapping),
    [sheetRows, mapping]
  );

  // --- Загрузка и парсинг файла ---

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setErr(null);
    setDryRun(null);
    setImportLog([]);
    setColumns([]);
    setSheetRows([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      // Удален лишний cast `as any[][]`, так как sheet_to_json<any[]> уже возвращает массив
      const raw = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        raw: true,
        defval: "",
      });

      if (!raw || raw.length === 0) {
        setParseError("Файл пуст или не удалось прочитать данные.");
        return;
      }

      let headerIndex = 0;
      for (let index = 0; index < Math.min(20, raw.length); index++) {
        const cells = stringsRow(raw[index]);
        if (cells.filter((cell) => cell !== "").length >= 2) {
          headerIndex = index;
          break;
        }
      }

      const header = uniqHeaders(stringsRow(raw[headerIndex]));
      const bodyRows = raw.slice(headerIndex + 1);

      const bodyObjects: RawRow[] = bodyRows.map((row) => {
        const objectRow: RawRow = {};
        for (let index = 0; index < header.length; index++) {
          objectRow[header[index]] = row[index] ?? "";
        }
        return objectRow;
      });

      setColumns(header);
      setSheetRows(bodyObjects);

      const guessParentUnit = (headers: string[]): string | null =>
        headers.find((headerName) =>
          /родитель|parent/i.test((headerName ?? "").toString())
        ) ?? null;

      const guessUnit = (headers: string[]): string | null =>
        headers.find((headerName) => {
          const lower = (headerName ?? "").toString().toLowerCase();
          return (
            /подраздел|отдел|управлен|служб|unit/.test(lower) &&
            !/родитель/.test(lower)
          );
        }) ?? null;

      const guess = (
        headers: string[],
        needle: RegExp
      ): string | null =>
        headers.find((headerName) =>
          needle.test((headerName ?? "").toString().toLowerCase())
        ) ?? null;

      setMapping({
        parentUnit: guessParentUnit(header),
        unit: guessUnit(header),
        team: guess(header, /групп|звено|отряд|team|команд/),
        fullName: guess(header, /фио|ф\.?и\.?о|name|фамил|сотрудник/),
        role: guess(header, /должн|роль|позици|role/),
        rank: guess(header, /звание|воинск|ранг|grade|rank/),
        phone: guess(header, /тел|phone|моб/),
        email: guess(header, /mail|почт|e-?mail/),
      });
    } catch (error_: any) {
      console.error(error_);
      setParseError(error_?.message || "Ошибка при чтении файла.");
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const resetAll = () => {
    setFileName(null);
    setColumns([]);
    setSheetRows([]);
    setMapping({
      parentUnit: null,
      unit: null,
      team: null,
      fullName: null,
      role: null,
      rank: null,
      phone: null,
      email: null,
    });
    setParseError(null);
    setErr(null);
    setDryRun(null);
    setImportLog([]);
    setProgress(0);
    setImporting(false);
  };

  // --- Анализ (dry-run) ---

  const runDryRun = async () => {
    if (!normalizedRows.length) return;

    setLoadingDryRun(true);
    setDryRun(null);
    setErr(null);

    try {
      const [units, teams, pyros] = await Promise.all([
        fetchOrganizationUnits(),
        fetchTeams(),
        fetchPyrotechnicians(),
      ]);

      const { unitsById, unitNameToId } = buildImportMaps(
        units,
        teams,
        pyros
      );

      // Используем helper для сбора существующих ключей (снижение Complexity)
      const {
        existingUnitKeys,
        existingTeamKeys,
        existingPyroNames,
        unitKey
      } = buildExistingSetsForDryRun(units, teams, pyros, unitsById);

      const unitsToCreateSet = new Map<
        string,
        { parent: string | null; name: string }
      >();
      const teamsToCreateSet = new Set<string>();
      const pyrosToCreate: NormalizedRow[] = [];

      for (const row of normalizedRows) {
        const unitKeyValue = unitKey(row.parentUnit, row.unit);
        if (!existingUnitKeys.has(unitKeyValue)) {
          if (!unitsToCreateSet.has(unitKeyValue)) {
            unitsToCreateSet.set(unitKeyValue, {
              parent: row.parentUnit,
              name: row.unit,
            });
          }
        }

        const unitId = unitNameToId.get(normKey(row.unit)) ?? 0;
        const teamExistingKey = `${unitId}::${normKey(row.team)}`;
        if (!existingTeamKeys.has(teamExistingKey)) {
          teamsToCreateSet.add(`${row.unit}::${row.team}`);
        }

        const pyroKey = normKey(row.fullName);
        if (!existingPyroNames.has(pyroKey)) {
          existingPyroNames.add(pyroKey);
          pyrosToCreate.push(row);
        }
      }

      const unitsToCreate = Array.from(unitsToCreateSet.values());
      const teamsToCreate = Array.from(teamsToCreateSet).map(
        (key) => {
          const [unit, team] = key.split("::");
          return { unit, team };
        }
      );

      setDryRun({
        unitsToCreate,
        teamsToCreate,
        pyrosToCreate,
      });
    } catch (error_: any) {
      console.error(error_);
      setErr(error_?.message || "Не удалось выполнить анализ.");
    } finally {
      setLoadingDryRun(false);
    }
  };

  // --- Импорт ---

  const doImport = async () => {
    if (!normalizedRows.length) return;

    setImporting(true);
    setProgress(0);
    setImportLog([]);
    setErr(null);

    try {
      const [units, teams, pyros] = await Promise.all([
        fetchOrganizationUnits(),
        fetchTeams(),
        fetchPyrotechnicians(),
      ]);

      const importMaps = buildImportMaps(units, teams, pyros);

      const unitPairs = collectUnitPairs(normalizedRows);
      const uniquePyroNames = collectUniquePyroNames(normalizedRows);
      const teamGroupKeys = collectTeamGroupKeys(normalizedRows);

      const totalSteps =
        unitPairs.length +
        uniquePyroNames.size +
        teamGroupKeys.size;
      let doneSteps = 0;

      const updateProgress = () => {
        setProgress(
          Math.round(
            (doneSteps / Math.max(totalSteps, 1)) * 100
          )
        );
      };

      const incrementProgress = () => {
        doneSteps += 1;
        updateProgress();
      };

      const addLog = (line: string) => {
        setImportLog((previous) => [...previous, line]);
      };

      await createMissingUnitsWithParents(
        unitPairs,
        importMaps,
        addLog,
        incrementProgress
      );

      await createMissingPyrotechniciansForRows(
        normalizedRows,
        importMaps.pyroNameToId,
        addLog,
        incrementProgress
      );

      await syncTeamsForGroups(
        normalizedRows,
        importMaps,
        addLog,
        incrementProgress
      );

      addLog("Импорт успешно завершён.");
    } catch (error_: any) {
      if (!isCanceled(error_)) {
        console.error(error_);
        const message =
          error_?.message || "При импорте произошла ошибка.";
        setErr(message);
        setImportLog((previous) => [
          ...previous,
          `Ошибка: ${message}`,
        ]);
      }
    } finally {
      setImporting(false);
    }
  };

  // --- Рендер ---

  const hasData = columns.length > 0 && sheetRows.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Импорт штатной структуры
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={resetAll}
        >
          Сбросить
        </Button>
      </Stack>

      {parseError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {parseError}
        </Alert>
      )}
      {err && !parseError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Stack spacing={1}>
              <Typography variant="h6">Шаг 1. Выберите файл</Typography>
              <Typography variant="body2" color="text.secondary">
                Поддерживаются CSV и Excel (xlsx). Первая строка с двумя и
                более заполненными ячейками считается заголовком.
              </Typography>
              {fileName && (
                <Chip
                  label={fileName}
                  variant="outlined"
                  sx={{ alignSelf: "flex-start" }}
                />
              )}
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Загрузить файл
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {hasData && (
        <Grid container spacing={3}>
          {/* Сопоставление колонок */}
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Шаг 2. Сопоставление полей
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  {(Object.keys(mappingLabels) as (keyof Mapping)[]).map(
                    (key) => {
                      const label = mappingLabels[key];
                      return (
                        <FormControl fullWidth size="small" key={key}>
                          <InputLabel>{label}</InputLabel>
                          <Select
                            label={label}
                            value={mapping[key] ?? ""}
                            onChange={(event) =>
                              setMapping((previous) => ({
                                ...previous,
                                [key]: event.target.value || null,
                              }))
                            }
                          >
                            <MenuItem value="">
                              <em>— не использовать —</em>
                            </MenuItem>
                            {columns.map((columnName) => (
                              <MenuItem key={columnName} value={columnName}>
                                {columnName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      );
                    }
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Анализ и сводка */}
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6">Шаг 3. Анализ</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={
                      loadingDryRun ? (
                        <CircularProgress size={16} />
                      ) : (
                        <PreviewIcon />
                      )
                    }
                    onClick={() => void runDryRun()}
                    disabled={loadingDryRun || !normalizedRows.length}
                  >
                    Проверить
                  </Button>
                </Stack>

                {loadingDryRun && <LinearProgress sx={{ mb: 2 }} />}

                {dryRun ? (
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      Будет создано подразделений:{" "}
                      <strong>{dryRun.unitsToCreate.length}</strong>
                    </Typography>
                    <Typography variant="body2">
                      Будет создано команд:{" "}
                      <strong>{dryRun.teamsToCreate.length}</strong>
                    </Typography>
                    <Typography variant="body2">
                      Будет создано сотрудников:{" "}
                      <strong>{dryRun.pyrosToCreate.length}</strong>
                    </Typography>

                    {dryRun.unitsToCreate.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2">
                          Новые подразделения:
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          {dryRun.unitsToCreate.slice(0, 6).map((unit) => (
                            <Typography
                              key={`${unit.parent ?? "root"}::${unit.name}`}
                              variant="caption"
                            >
                              {unit.parent
                                ? `${unit.parent} → ${unit.name}`
                                : unit.name}
                            </Typography>
                          ))}
                          {dryRun.unitsToCreate.length > 6 && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              … и ещё {dryRun.unitsToCreate.length - 6}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Нажмите «Проверить», чтобы увидеть, что именно будет
                    создано.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Импорт и лог */}
          <Grid item xs={12} lg={4}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent sx={{ flexGrow: 0 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6">Шаг 4. Импорт</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="contained"
                    startIcon={
                      importing ? (
                        <CircularProgress size={16} />
                      ) : (
                        <PlayArrowIcon />
                      )
                    }
                    onClick={() => void doImport()}
                    disabled={importing || !normalizedRows.length}
                  >
                    Запустить
                  </Button>
                </Stack>

                {importing && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress variant="determinate" value={progress} />
                    <Typography
                      variant="caption"
                      sx={{ display: "block", mt: 0.5 }}
                    >
                      Выполнено: {progress}%
                    </Typography>
                  </Box>
                )}
              </CardContent>

              <Divider />

              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Лог импорта
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 1,
                    p: 1.5,
                    height: 220,
                    overflow: "auto",
                    fontFamily: "monospace",
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {importLog.length
                    ? importLog.join("\n")
                    : "Здесь появятся подробности выполнения импорта."}
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}