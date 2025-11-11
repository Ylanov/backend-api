// frontend/src/pages/StaffAndStructurePage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Grid,
  Stack,
  Typography,
  CircularProgress,
  Button,
  Box,
  Alert,
  Paper,
  Divider,
  Chip,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  TextField,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import GroupsIcon from "@mui/icons-material/Groups";
import DeleteIcon from "@mui/icons-material/Delete";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";

import type {
  OrganizationNode,
  Pyrotechnician,
  Team,
  OrganizationUnit,
} from "../types";

import {
  fetchOrganizationStructure,
  fetchUnassignedPyrotechnicians,
  fetchOrganizationUnits,
  fetchTeams,
  deleteOrganizationUnit,
  deleteOrganizationUnitCascade,
  deleteTeam,
  patchTeam,
  deletePyrotechnician,
  deletePyrotechniciansBulk,
} from "../services/api";

import OrganizationTree from "../components/OrganizationTree";
import UnassignedPyrosList from "../components/UnassignedPyrosList";
import UnitDialog from "../components/UnitDialog";
import CreateTeamDialog from "../components/CreateTeamDialog";
import EditTeamDialog from "../components/EditTeamDialog";
import PyrotechnicianDialog from "../components/PyrotechnicianDialog";

// ---- Компактное управление командами ----

type UnitItem = {
  id: number;
  name: string;
  path: string;
  teamNodeIds: string[];
};

const collectUnits = (
  nodes: OrganizationNode[],
  parentPath = ""
): UnitItem[] => {
  const result: UnitItem[] = [];

  for (const node of nodes) {
    if (node.type !== "unit") continue;

    const unitId = Number(node.id.replace("unit-", ""));
    const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
    const teamNodeIds =
      node.children?.filter((c) => c.type === "team").map((c) => c.id) ?? [];

    result.push({ id: unitId, name: node.name, path, teamNodeIds });

    const subunits =
      node.children?.filter((c) => c.type === "unit") ?? [];
    if (subunits.length) {
      result.push(...collectUnits(subunits, path));
    }
  }

  return result;
};

const TeamsDashboard = ({
  nodes,
  onAddTeam,
  onEditTeam,
  teamsMap,
}: {
  nodes: OrganizationNode[];
  onAddTeam: (unitId: number) => void;
  onEditTeam: (team: Team) => void;
  teamsMap: Map<number, Team>;
}) => {
  const unitItems = useMemo(() => collectUnits(nodes), [nodes]);

  const [activeUnitId, setActiveUnitId] = useState<number | null>(
    unitItems.length ? unitItems[0].id : null
  );

  // если структура изменилась — корректируем выбранный юнит
  useEffect(() => {
    if (!unitItems.length) {
      setActiveUnitId(null);
      return;
    }
    if (!activeUnitId || !unitItems.some((u) => u.id === activeUnitId)) {
      setActiveUnitId(unitItems[0].id);
    }
  }, [unitItems, activeUnitId]);

  if (!unitItems.length) {
    return (
      <Typography color="text.secondary">
        Пока нет ни одного подразделения с командами.
      </Typography>
    );
  }

  const activeUnit =
    unitItems.find((u) => u.id === activeUnitId) ?? unitItems[0];

  const activeTeams: Team[] = activeUnit.teamNodeIds
    .map((nid) => {
      const teamId = Number(nid.replace("team-", ""));
      return teamsMap.get(teamId) || null;
    })
    .filter((t): t is Team => t !== null);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ height: "100%" }}>
          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FolderIcon fontSize="small" />
              <Typography variant="subtitle1">
                Подразделения с командами
              </Typography>
            </Stack>
          </Box>
          <Divider />
          <List dense sx={{ maxHeight: 360, overflow: "auto" }}>
            {unitItems.map((u) => (
              <ListItemButton
                key={u.id}
                selected={u.id === activeUnit.id}
                onClick={() => setActiveUnitId(u.id)}
              >
                <ListItemText
                  primary={u.name}
                  secondary={
                    u.path !== u.name ? u.path : undefined
                  }
                />
                <Chip
                  label={u.teamNodeIds.length}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>

      <Grid item xs={12} md={8}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Stack spacing={0.3}>
              <Typography variant="subtitle1">
                Команды подразделения
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activeUnit.path}
              </Typography>
            </Stack>
            <Tooltip
              title={`Добавить команду в "${activeUnit.name}"`}
            >
              <Button
                size="small"
                startIcon={<GroupAddIcon />}
                onClick={() => onAddTeam(activeUnit.id)}
              >
                Новая команда
              </Button>
            </Tooltip>
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {activeTeams.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              В этом подразделении пока нет команд.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {activeTeams.map((team) => (
                <Paper
                  key={team.id}
                  variant="outlined"
                  sx={{ p: 1.25 }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                  >
                    <GroupsIcon fontSize="small" color="action" />
                    <Typography fontWeight={500}>
                      {team.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${team.members.length} чел.`}
                      sx={{ ml: 1 }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="Редактировать команду">
                      <IconButton
                        size="small"
                        onClick={() => onEditTeam(team)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Руководитель:{" "}
                    {team.lead?.full_name || "не назначен"}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

// ---- Тулбар для выделенных элементов ----

const SelectionToolbar = ({
  selectedIds,
  onBulkDeletePyros,
  onClearSelection,
}: {
  selectedIds: Set<string>;
  onBulkDeletePyros: () => void;
  onClearSelection: () => void;
}) => {
  const selectedCount = selectedIds.size;
  if (selectedCount === 0) return null;

  const { pyros, teams, units } = useMemo(() => {
    const result = { pyros: 0, teams: 0, units: 0 };
    selectedIds.forEach((id) => {
      if (id.startsWith("pyro-")) result.pyros++;
      else if (id.startsWith("team-")) result.teams++;
      else if (id.startsWith("unit-")) result.units++;
    });
    return result;
  }, [selectedIds]);

  const canDeletePyros = pyros > 0 && teams === 0 && units === 0;

  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{
        top: "auto",
        bottom: 0,
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Toolbar>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Выбрано: {selectedCount}
        </Typography>

        <Tooltip title="Удалить выбранных сотрудников">
          <span>
            <IconButton
              color="error"
              onClick={onBulkDeletePyros}
              disabled={!canDeletePyros}
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Button onClick={onClearSelection} sx={{ ml: 2 }}>
          Снять выделение
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default function StaffAndStructurePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [structure, setStructure] = useState<OrganizationNode[]>([]);
  const [unassigned, setUnassigned] = useState<Pyrotechnician[]>([]);
  const [allUnits, setAllUnits] = useState<OrganizationUnit[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [unitDialog, setUnitDialog] = useState<{
    open: boolean;
    unit: Partial<OrganizationUnit> | null;
    parentId: number | null;
  }>({ open: false, unit: null, parentId: null });

  const [createTeamDialog, setCreateTeamDialog] = useState<{
    open: boolean;
    unitId: number | null;
  }>({ open: false, unitId: null });

  const [editTeamDialog, setEditTeamDialog] = useState<{
    open: boolean;
    team: Team | null;
  }>({ open: false, team: null });

  const [pyroDialog, setPyroDialog] = useState<{
    open: boolean;
    pyro: Pyrotechnician | null;
  }>({ open: false, pyro: null });

  const [unassignedFilter, setUnassignedFilter] = useState("");

  const loadData = async () => {
    setError(null);
    setLoading(true);
    try {
      const [tree, free, units, teams] = await Promise.all([
        fetchOrganizationStructure(),
        fetchUnassignedPyrotechnicians(),
        fetchOrganizationUnits(),
        fetchTeams(),
      ]);
      setStructure(tree);
      setUnassigned(free);
      setAllUnits(units);
      setAllTeams(teams);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          e?.message ??
          "Не удалось загрузить данные"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const teamsMap = useMemo(
    () => new Map(allTeams.map((team) => [team.id, team])),
    [allTeams]
  );

  const filteredUnassigned = useMemo(() => {
    const q = unassignedFilter.trim().toLowerCase();
    if (!q) return unassigned;
    return unassigned.filter((p) =>
      p.full_name.toLowerCase().includes(q)
    );
  }, [unassigned, unassignedFilter]);

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAllUnassigned = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      unassigned.forEach((p) => next.add(`pyro-${p.id}`));
      return next;
    });
  };

  const clearUnassignedSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      unassigned.forEach((p) => next.delete(`pyro-${p.id}`));
      return next;
    });
  };

  const handleAddUnit = (parentId: number | null) =>
    setUnitDialog({ open: true, unit: null, parentId });

  const handleEditUnit = (unit: OrganizationUnit) =>
    setUnitDialog({ open: true, unit, parentId: null });

  const handleDeleteUnit = async (unit: OrganizationUnit) => {
    const message = `Вы уверены, что хотите удалить подразделение "${unit.name}"?`;
    const confirmation = prompt(
      `${message}\n\nВНИМАНИЕ: Если у подразделения есть дочерние элементы, простое удаление не сработает.\n\n- Чтобы удалить только это подразделение (если оно пустое), введите "удалить".\n- Чтобы удалить это подразделение ВМЕСТЕ СО ВСЕМ СОДЕРЖИМЫМ, введите "удалить всё".`
    );
    if (confirmation === null) return;
    const trimmed = confirmation.trim().toLowerCase();

    try {
      if (trimmed === "удалить всё") {
        await deleteOrganizationUnitCascade(unit.id);
        alert(
          `Подразделение "${unit.name}" и все его содержимое было удалено.`
        );
      } else if (trimmed === "удалить") {
        await deleteOrganizationUnit(unit.id);
        alert(`Подразделение "${unit.name}" было удалено.`);
      } else {
        alert("Действие отменено. Вы не ввели подтверждение.");
        return;
      }
      await loadData();
    } catch (e: any) {
      alert(
        `Ошибка удаления: ${
          e?.response?.data?.detail || e?.message || e
        }`
      );
    }
  };

  const handleAddTeam = (unitId: number) =>
    setCreateTeamDialog({ open: true, unitId });

  const handleEditTeam = (team: Team) =>
    setEditTeamDialog({ open: true, team });

  const handleDeleteTeam = async (team: Team) => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить команду "${team.name}"?`
      )
    )
      return;
    try {
      await deleteTeam(team.id);
      await loadData();
    } catch (e: any) {
      alert(
        `Ошибка удаления: ${
          e?.response?.data?.detail || e?.message || e
        }`
      );
    }
  };

  const handleAddPyro = () =>
    setPyroDialog({ open: true, pyro: null });

  const handleEditPyro = (pyro: Pyrotechnician) =>
    setPyroDialog({ open: true, pyro });

  const handleDeletePyro = async (pyro: Pyrotechnician) => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить сотрудника "${pyro.full_name}"?`
      )
    )
      return;
    try {
      await deletePyrotechnician(pyro.id);
      await loadData();
    } catch (e: any) {
      alert(
        `Ошибка удаления: ${
          e?.response?.data?.detail || e?.message || e
        }`
      );
    }
  };

  const handleBulkDeletePyros = async () => {
    const pyroIds = [...selectedIds]
      .filter((id) => id.startsWith("pyro-"))
      .map((id) => Number(id.replace("pyro-", "")));

    if (!pyroIds.length) return;

    if (
      !window.confirm(
        `Вы уверены, что хотите удалить ${pyroIds.length} сотрудников? Это действие необратимо.`
      )
    )
      return;

    try {
      await deletePyrotechniciansBulk(pyroIds);
      clearSelection();
      await loadData();
    } catch (e: any) {
      alert(`Ошибка массового удаления: ${e?.message || e}`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const pyroId = Number(String(active.id).replace("pyro-", ""));
    if (!pyroId) return;

    if (String(over.id).startsWith("team-")) {
      const teamId = Number(String(over.id).replace("team-", ""));
      const team = teamsMap.get(teamId);
      if (!team || team.members.some((m) => m.id === pyroId)) return;

      const member_ids = [...team.members.map((m) => m.id), pyroId];
      try {
        await patchTeam(teamId, { member_ids });
        await loadData();
      } catch (e: any) {
        alert(`Не удалось переместить сотрудника: ${e?.message || e}`);
      }
    }

    if (over.id === "unassigned-droppable-area") {
      const sourceTeam = allTeams.find((t) =>
        t.members.some((m) => m.id === pyroId)
      );
      if (!sourceTeam) return;

      const member_ids = sourceTeam.members
        .filter((m) => m.id !== pyroId)
        .map((m) => m.id);
      try {
        await patchTeam(sourceTeam.id, { member_ids });
        await loadData();
      } catch (e: any) {
        alert(
          `Не удалось вернуть сотрудника в резерв: ${e?.message || e}`
        );
      }
    }
  };

  const closeAllDialogs = () => {
    setUnitDialog({ open: false, unit: null, parentId: null });
    setCreateTeamDialog({ open: false, unitId: null });
    setEditTeamDialog({ open: false, team: null });
    setPyroDialog({ open: false, pyro: null });
  };

  const onSaveAndClose = () => {
    clearSelection();
    closeAllDialogs();
    void loadData();
  };

  const unitsCount = allUnits.length;
  const teamsCount = allTeams.length;
  const unassignedCount = unassigned.length;

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <Box sx={{ pb: 8 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <AccountTreeIcon fontSize="large" />
          <Typography variant="h4" fontWeight={700}>
            Штатная структура и кадры
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            component={RouterLink}
            to="/structure/import"
          >
            Импорт
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Обновление..." : "Обновить"}
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Ошибка: {error}
          </Alert>
        )}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid item xs={12} md={7} lg={8}>
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="h5" gutterBottom>
                    Структура подразделений
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Подразделений: {unitsCount} · Команд: {teamsCount}
                  </Typography>
                </Box>

                <OrganizationTree
                  nodes={structure}
                  teamsMap={teamsMap}
                  onAddUnit={handleAddUnit}
                  onEditUnit={handleEditUnit}
                  onDeleteUnit={handleDeleteUnit}
                  onEditTeam={handleEditTeam}
                  onDeleteTeam={handleDeleteTeam}
                  onEditPyro={handleEditPyro}
                  onDeletePyro={handleDeletePyro}
                  selectedIds={selectedIds}
                  onToggleSelection={handleToggleSelection}
                />
              </Grid>

              <Grid item xs={12} md={5} lg={4}>
                <Stack spacing={1.5} sx={{ height: "100%" }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="h5" gutterBottom>
                        Резерв сотрудников
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        В резерве: {unassignedCount}
                      </Typography>
                    </Box>

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      <TextField
                        size="small"
                        placeholder="Поиск по ФИО"
                        value={unassignedFilter}
                        onChange={(e) =>
                          setUnassignedFilter(e.target.value)
                        }
                        sx={{ minWidth: 160 }}
                      />
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <Button
                          size="small"
                          onClick={selectAllUnassigned}
                        >
                          Выделить всех
                        </Button>
                        <Button
                          size="small"
                          onClick={clearUnassignedSelection}
                        >
                          Снять
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>

                  <UnassignedPyrosList
                    pyros={filteredUnassigned}
                    onAddPyro={handleAddPyro}
                    onEditPyro={handleEditPyro}
                    onDeletePyro={handleDeletePyro}
                    selectedIds={selectedIds}
                    onToggleSelection={handleToggleSelection}
                  />
                </Stack>
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }}>
              <Chip label="Управление командами" />
            </Divider>

            <TeamsDashboard
              nodes={structure}
              onAddTeam={handleAddTeam}
              onEditTeam={handleEditTeam}
              teamsMap={teamsMap}
            />
          </>
        )}

        <UnitDialog
          open={unitDialog.open}
          onClose={closeAllDialogs}
          onSave={onSaveAndClose}
          unit={unitDialog.unit}
          parentId={unitDialog.parentId}
        />
        <CreateTeamDialog
          open={createTeamDialog.open}
          onClose={closeAllDialogs}
          onCreated={onSaveAndClose}
          allUnits={allUnits}
          initialUnitId={createTeamDialog.unitId}
        />
        <EditTeamDialog
          open={editTeamDialog.open}
          onClose={closeAllDialogs}
          onUpdated={onSaveAndClose}
          team={editTeamDialog.team}
          allUnits={allUnits}
        />
        <PyrotechnicianDialog
          open={pyroDialog.open}
          onClose={closeAllDialogs}
          onSave={onSaveAndClose}
          pyro={pyroDialog.pyro}
        />

        <SelectionToolbar
          selectedIds={selectedIds}
          onBulkDeletePyros={handleBulkDeletePyros}
          onClearSelection={clearSelection}
        />
      </Box>
    </DndContext>
  );
}
