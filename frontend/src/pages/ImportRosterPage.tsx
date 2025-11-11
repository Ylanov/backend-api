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
  TextField,
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

const norm = (value: any): string =>
  (value ?? "").toString().trim();

const normKey = (value: string): string =>
  norm(value).toLowerCase();

const stringsRow = (row: any[]): string[] =>
  row.map((cell) => norm(cell));

const uniqHeaders = (headers: string[]): string[] => {
  const used = new Map<string, number>();
  return headers.map((h, index) => {
    const base = h || `col_${index + 1}`;
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

  const normalizedRows: NormalizedRow[] = useMemo(() => {
    if (!sheetRows.length || !mapping.unit || !mapping.fullName) return [];

    let currentParentUnit: string | null = null;
    let currentUnit: string | null = null;
    let currentTeam: string | null = null;

    const result: NormalizedRow[] = [];

    for (const row of sheetRows) {
      const fullName = norm(row[mapping.fullName!]);
      if (!fullName) {
        // Если нет ФИО, строку пропускаем (заголовки/пробелы)
        continue;
      }

      // Родительское подразделение тянем вниз
      let parentUnit: string | null = null;
      if (mapping.parentUnit) {
        const rawParent = norm(row[mapping.parentUnit]);
        if (rawParent) {
          currentParentUnit = rawParent;
        }
        parentUnit = currentParentUnit;
      }

      // Подразделение / отдел тянем вниз
      const rawUnit = norm(row[mapping.unit!]);
      if (rawUnit) {
        currentUnit = rawUnit;
      }
      const unit = currentUnit || rawUnit || "Без подразделения";

      // Команда / группа тянется вниз
      let team = "Без группы";
      if (mapping.team) {
        const rawTeam = norm(row[mapping.team]);
        if (rawTeam) {
          currentTeam = rawTeam;
        }
        team = currentTeam || rawTeam || "Без группы";
      }

      result.push({
        parentUnit,
        unit,
        team,
        fullName,
        role: mapping.role ? norm(row[mapping.role]) || null : null,
        rank: mapping.rank ? norm(row[mapping.rank]) || null : null,
        phone: mapping.phone ? norm(row[mapping.phone]) || null : null,
        email: mapping.email ? norm(row[mapping.email]) || null : null,
      });
    }

    return result;
  }, [sheetRows, mapping]);

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
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        raw: true,
        defval: "",
      }) as any[][];

      if (!raw || raw.length === 0) {
        setParseError("Файл пуст или не удалось прочитать данные.");
        return;
      }

      // Ищем строку заголовков — первую строку, где хотя бы 2 непустые ячейки
      let headerIdx = 0;
      for (let i = 0; i < Math.min(20, raw.length); i++) {
        const cells = stringsRow(raw[i]);
        if (cells.filter((c) => c !== "").length >= 2) {
          headerIdx = i;
          break;
        }
      }

      const header = uniqHeaders(stringsRow(raw[headerIdx]));
      const bodyRows = raw.slice(headerIdx + 1);

      const bodyObjects: RawRow[] = bodyRows.map((row) => {
        const obj: RawRow = {};
        for (let i = 0; i < header.length; i++) {
          obj[header[i]] = row[i] ?? "";
        }
        return obj;
      });

      setColumns(header);
      setSheetRows(bodyObjects);

      // Авто-гадывание соответствий колонок
      const guessParentUnit = (headers: string[]): string | null =>
        headers.find((h) =>
          /родитель|parent/i.test((h ?? "").toString())
        ) ?? null;

      const guessUnit = (headers: string[]): string | null =>
        headers.find((h) => {
          const low = (h ?? "").toString().toLowerCase();
          return (
            /подраздел|отдел|управлен|служб|unit/.test(low) &&
            !/родитель/.test(low)
          );
        }) ?? null;

      const guess = (headers: string[], needle: RegExp): string | null =>
        headers.find((h) =>
          needle.test((h ?? "").toString().toLowerCase())
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
    } catch (e: any) {
      console.error(e);
      setParseError(e?.message || "Ошибка при чтении файла.");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

      const unitsById = new Map<number, OrganizationUnit>();
      units.forEach((u) => unitsById.set(u.id, u));

      const unitKey = (parentName: string | null, name: string) => {
        const parent = parentName ? normKey(parentName) : "root";
        return `${parent}::${normKey(name)}`;
      };

      const existingUnitKeys = new Set<string>();
      units.forEach((u) => {
        const parentName =
          u.parent_id != null ? unitsById.get(u.parent_id)?.name ?? null : null;
        existingUnitKeys.add(unitKey(parentName, u.name));
      });

      const existingTeamKeys = new Set<string>();
      teams.forEach((t) => {
        const uid = t.organization_unit_id ?? 0;
        existingTeamKeys.add(`${uid}::${normKey(t.name)}`);
      });

      const existingPyroNames = new Set<string>();
      pyros.forEach((p) => existingPyroNames.add(normKey(p.full_name)));

      const unitsToCreateSet = new Map<string, { parent: string | null; name: string }>();
      const teamsToCreateSet = new Set<string>();
      const pyrosToCreate: NormalizedRow[] = [];

      // Предполагаем, что названия подразделений уникальны (как в твоей штатке)
      const unitNameToId = new Map<string, number>();
      units.forEach((u) => unitNameToId.set(normKey(u.name), u.id));

      for (const row of normalizedRows) {
        const uKey = unitKey(row.parentUnit, row.unit);
        if (!existingUnitKeys.has(uKey)) {
          if (!unitsToCreateSet.has(uKey)) {
            unitsToCreateSet.set(uKey, {
              parent: row.parentUnit,
              name: row.unit,
            });
          }
        }

        const unitId = unitNameToId.get(normKey(row.unit)) ?? 0;
        const tKeyExisting = `${unitId}::${normKey(row.team)}`;
        if (!existingTeamKeys.has(tKeyExisting)) {
          teamsToCreateSet.add(`${row.unit}::${row.team}`);
        }

        const pyroKey = normKey(row.fullName);
        if (!existingPyroNames.has(pyroKey)) {
          existingPyroNames.add(pyroKey);
          pyrosToCreate.push(row);
        }
      }

      const unitsToCreate = Array.from(unitsToCreateSet.values());
      const teamsToCreate = Array.from(teamsToCreateSet).map((k) => {
        const [unit, team] = k.split("::");
        return { unit, team };
      });

      setDryRun({
        unitsToCreate,
        teamsToCreate,
        pyrosToCreate,
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Не удалось выполнить анализ.");
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

      const unitsById = new Map<number, OrganizationUnit>();
      units.forEach((u) => unitsById.set(u.id, u));

      const unitNameToId = new Map<string, number>();
      units.forEach((u) => unitNameToId.set(normKey(u.name), u.id));

      const teamByKey = new Map<string, Team>();
      teams.forEach((t) => {
        const uid = t.organization_unit_id ?? 0;
        const key = `${uid}::${normKey(t.name)}`;
        teamByKey.set(key, t);
      });

      const pyroNameToId = new Map<string, number>();
      pyros.forEach((p) => pyroNameToId.set(normKey(p.full_name), p.id));

      // Подготовка списков для оценки прогресса
      const unitPairsMap = new Map<string, { parent: string | null; name: string }>();
      for (const row of normalizedRows) {
        const key = `${row.parentUnit ?? ""}::${row.unit}`;
        if (!unitPairsMap.has(key)) {
          unitPairsMap.set(key, { parent: row.parentUnit, name: row.unit });
        }
      }
      const unitPairs = Array.from(unitPairsMap.values());

      const uniquePyroNames = new Set<string>();
      normalizedRows.forEach((r) => uniquePyroNames.add(normKey(r.fullName)));

      const teamGroupKeys = new Set<string>();
      normalizedRows.forEach((r) =>
        teamGroupKeys.add(`${r.unit}::${r.team}`)
      );

      const totalSteps =
        unitPairs.length + uniquePyroNames.size + teamGroupKeys.size;
      let doneSteps = 0;

      const updateProgress = () => {
        setProgress(
          Math.round((doneSteps / Math.max(totalSteps, 1)) * 100)
        );
      };

      // --- Шаг 1. Создаём недостающие подразделения с учётом родителей ---
      const pendingUnits = unitPairs.filter(
        (p) => !unitNameToId.has(normKey(p.name))
      );

      let safety = 0;
      while (pendingUnits.length && safety < 1000) {
        safety += 1;
        let progressed = false;

        for (let i = pendingUnits.length - 1; i >= 0; i--) {
          const u = pendingUnits[i];

          if (unitNameToId.has(normKey(u.name))) {
            pendingUnits.splice(i, 1);
            continue;
          }

          let parentId: number | null = null;
          if (u.parent) {
            const pId = unitNameToId.get(normKey(u.parent));
            if (pId == null) {
              // Родитель ещё не создан
              continue;
            }
            parentId = pId;
          }

          const payload = {
            name: u.name,
            parent_id: parentId,
            description: null,
          };

          const created = await createOrganizationUnit(
            payload as any
          );

          unitNameToId.set(normKey(created.name), created.id);
          unitsById.set(created.id, created);

          doneSteps += 1;
          updateProgress();

          setImportLog((prev) => [
            ...prev,
            `Создано подразделение "${u.name}" (родитель: ${
              u.parent ?? "—"
            })`,
          ]);

          pendingUnits.splice(i, 1);
          progressed = true;
        }

        if (!progressed) {
          // На всякий случай, чтобы не попасть в бесконечный цикл,
          // если какая-то цепочка не может быть разрешена.
          break;
        }
      }

      // --- Шаг 2. Создаём недостающих сотрудников ---
      for (const row of normalizedRows) {
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
        };

        const created = await createPyrotechnician(payload);

        pyroNameToId.set(key, created.id);

        doneSteps += 1;
        updateProgress();

        setImportLog((prev) => [
          ...prev,
          `Создан сотрудник "${row.fullName}"`,
        ]);
      }

      // --- Шаг 3. Создаём / обновляем команды и их состав ---

      const groups = new Map<
        string,
        { unitName: string; teamName: string; rows: NormalizedRow[] }
      >();

      for (const row of normalizedRows) {
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

      for (const [, group] of groups) {
        const unitId = unitNameToId.get(normKey(group.unitName));
        if (!unitId) {
          setImportLog((prev) => [
            ...prev,
            `⚠ Не найдено подразделение "${group.unitName}" для команды "${group.teamName}"`,
          ]);
          continue;
        }

        const memberIds: number[] = [];
        for (const row of group.rows) {
          const id = pyroNameToId.get(normKey(row.fullName));
          if (id) {
            memberIds.push(id);
          }
        }

        const key = `${unitId}::${normKey(group.teamName)}`;
        const existingTeam = teamByKey.get(key);

        if (existingTeam) {
          await patchTeam(existingTeam.id, {
            member_ids: memberIds,
          });
          setImportLog((prev) => [
            ...prev,
            `Обновлена команда "${group.teamName}" в подразделении "${group.unitName}" (${memberIds.length} сотрудников)`,
          ]);
        } else {
          await createTeam({
            name: group.teamName,
            organization_unit_id: unitId,
            member_ids: memberIds,
          });
          setImportLog((prev) => [
            ...prev,
            `Создана команда "${group.teamName}" в подразделении "${group.unitName}" (${memberIds.length} сотрудников)`,
          ]);
        }

        doneSteps += 1;
        updateProgress();
      }

      setImportLog((prev) => [...prev, "Импорт успешно завершён."]);
    } catch (e: any) {
      if (!isCanceled(e)) {
        console.error(e);
        setErr(e?.message || "При импорте произошла ошибка.");
        setImportLog((prev) => [
          ...prev,
          `Ошибка: ${e?.message || String(e)}`,
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
                            onChange={(e) =>
                              setMapping((m) => ({
                                ...m,
                                [key]: e.target.value || null,
                              }))
                            }
                          >
                            <MenuItem value="">
                              <em>— не использовать —</em>
                            </MenuItem>
                            {columns.map((c) => (
                              <MenuItem key={c} value={c}>
                                {c}
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
                          {dryRun.unitsToCreate.slice(0, 6).map((u) => (
                            <Typography
                              key={`${u.parent ?? "root"}::${u.name}`}
                              variant="caption"
                            >
                              {u.parent
                                ? `${u.parent} → ${u.name}`
                                : u.name}
                            </Typography>
                          ))}
                          {dryRun.unitsToCreate.length > 6 && (
                            <Typography variant="caption" color="text.secondary">
                              … и ещё{" "}
                              {dryRun.unitsToCreate.length - 6}
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
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
