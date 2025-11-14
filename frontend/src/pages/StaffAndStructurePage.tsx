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
  ButtonGroup,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import GroupsIcon from "@mui/icons-material/Groups";
import DeleteIcon from "@mui/icons-material/Delete";
import ClearAllIcon from "@mui/icons-material/ClearAll";
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
  isCanceled,
} from "../services/api";

import OrganizationTree from "../components/OrganizationTree";
import UnassignedPyrosList from "../components/UnassignedPyrosList";
import UnitDialog from "../components/UnitDialog";
import CreateTeamDialog from "../components/CreateTeamDialog";
import EditTeamDialog from "../components/EditTeamDialog";
import PyrotechnicianDialog from "../components/PyrotechnicianDialog";
import PageHeader from "../components/PageHeader";
import { useNotification } from "../notifications/NotificationProvider";
import ConfirmDeleteUnitDialog, {
  type DeleteMode,
} from "../components/ConfirmDeleteUnitDialog";

/** ------- Вспомогательные блоки: TeamsDashboard, SelectionToolbar ------- */

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
    const subunits = node.children?.filter((c) => c.type === "unit") ?? [];
    if (subunits.length) result.push(...collectUnits(subunits, path));
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
              <Typography variant="subtitle1">Подразделения с командами</Typography>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ maxHeight: { xs: 240, md: 360 }, overflow: "auto" }}>
            {unitItems.map((u) => (
              <Stack
                key={u.id}
                direction="row"
                alignItems="center"
                sx={{
                  px: 1.5,
                  py: 1,
                  cursor: "pointer",
                  bgcolor: u.id === activeUnit.id ? "action.hover" : "transparent",
                }}
                onClick={() => setActiveUnitId(u.id)}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap fontWeight={u.id === activeUnit.id ? 600 : 400}>
                    {u.name}
                  </Typography>
                  {u.path !== u.name && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {u.path}
                    </Typography>
                  )}
                </Box>
                <Chip label={u.teamNodeIds.length} size="small" sx={{ ml: 1 }}/>
              </Stack>
            ))}
          </Box>
        </Paper>
      </Grid>

      <Grid item xs={12} md={8}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            mb={1.5}
            spacing={{ xs: 1.5, sm: 1 }}
          >
            <Stack spacing={0.3}>
              <Typography variant="subtitle1">Команды подразделения</Typography>
              <Typography variant="body2" color="text.secondary">
                {activeUnit.path}
              </Typography>
            </Stack>
            <Tooltip title={`Добавить команду в "${activeUnit.name}"`}>
              <Button
                size="small"
                startIcon={<GroupAddIcon />}
                onClick={() => onAddTeam(activeUnit.id)}
                sx={{ width: { xs: "100%", sm: "auto" } }}
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
                <Paper key={team.id} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <GroupsIcon fontSize="small" color="action" />
                    <Typography fontWeight={500}>{team.name}</Typography>
                    <Chip size="small" label={`${team.members.length} чел.`} sx={{ ml: 1 }} />
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="Редактировать команду">
                      <IconButton size="small" onClick={() => onEditTeam(team)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Руководитель: {team.lead?.full_name || "не назначен"}
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

  const summary = useMemo(() => {
    const s = { pyros: 0, teams: 0, units: 0 };
    selectedIds.forEach((id) => {
      if (id.startsWith("pyro-")) s.pyros++;
      else if (id.startsWith("team-")) s.teams++;
      else if (id.startsWith("unit-")) s.units++;
    });
    return s;
  }, [selectedIds]);

  const canDeletePyros = summary.pyros > 0 && summary.teams === 0 && summary.units === 0;

  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{
        top: "auto",
        bottom: 0,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(8px)",
        boxShadow: "none",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ px: { xs: 1, sm: 2 } }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Выбрано: {selectedCount}
        </Typography>

        <Tooltip title="Удалить выбранных сотрудников">
          <span>
            <IconButton color="error" onClick={onBulkDeletePyros} disabled={!canDeletePyros}>
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Снять выделение">
            <IconButton onClick={onClearSelection} sx={{ ml: 1 }}>
              <ClearAllIcon />
            </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};

/** ------------------------ Основной компонент ------------------------ */

export default function StaffAndStructurePage() {
  const { notifyError, notifySuccess } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [structure, setStructure] = useState<OrganizationNode[]>([]);
  const [unassigned, setUnassigned] = useState<Pyrotechnician[]>([]);
  const [allUnits, setAllUnits] = useState<OrganizationUnit[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Диалоги
  const [unitDialog, setUnitDialog] = useState<{
    open: boolean;
    unit: Partial<OrganizationUnit> | null;
    parentId: number | null;
  }>({ open: false, unit: null, parentId: null });

  const [createTeamDialog, setCreateTeamDialog] = useState<{ open: boolean; unitId: number | null; }>({ open: false, unitId: null });

  const [editTeamDialog, setEditTeamDialog] = useState<{ open: boolean; team: Team | null; }>({ open: false, team: null });

  const [pyroDialog, setPyroDialog] = useState<{ open: boolean; pyro: Pyrotechnician | null; }>({ open: false, pyro: null });

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; unit: OrganizationUnit | null; }>({ open: false, unit: null });

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
      if (isCanceled(e)) return;
      const msg = e?.response?.data?.detail ?? e?.message ?? "Не удалось загрузить данные";
      setError(msg);
      notifyError(msg);
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
    return unassigned.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [unassigned, unassignedFilter]);

  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteUnit = (unit: OrganizationUnit) =>
    setConfirmDelete({ open: true, unit });

  const confirmDeleteUnit = async (mode: DeleteMode) => {
    const unit = confirmDelete.unit!;
    try {
      if (mode === "cascade") {
        await deleteOrganizationUnitCascade(unit.id);
        notifySuccess(`Подразделение «${unit.name}» и всё содержимое удалено.`);
      } else {
        await deleteOrganizationUnit(unit.id);
        notifySuccess(`Подразделение «${unit.name}» удалено.`);
      }
      setConfirmDelete({ open: false, unit: null });
      await loadData();
    } catch (e: any)      {
        notifyError(`Ошибка удаления: ${e?.response?.data?.detail || e?.message || e}`);
      }
    };

    const handleDeleteTeam = async (team: Team) => {
      if (!window.confirm(`Удалить команду «${team.name}»?`)) return;
      try {
        await deleteTeam(team.id);
        notifySuccess(`Команда «${team.name}» удалена.`);
        await loadData();
      } catch (e: any) {
        notifyError(`Ошибка удаления: ${e?.response?.data?.detail || e?.message || e}`);
      }
    };

    const handleDeletePyro = async (pyro: Pyrotechnician) => {
      if (!window.confirm(`Удалить сотрудника «${pyro.full_name}»?`)) return;
      try {
        await deletePyrotechnician(pyro.id);
        notifySuccess("Сотрудник удалён.");
        await loadData();
      } catch (e: any) {
        notifyError(`Ошибка удаления: ${e?.response?.data?.detail || e?.message || e}`);
      }
    };

    const handleBulkDeletePyros = async () => {
      const pyroIds = [...selectedIds]
        .filter((id) => id.startsWith("pyro-"))
        .map((id) => Number(id.replace("pyro-", "")));

      if (!pyroIds.length) return;
      if (!window.confirm(`Удалить ${pyroIds.length} выбранных сотрудник(ов)? Действие необратимо.`)) return;

      try {
        await deletePyrotechniciansBulk(pyroIds);
        clearSelection();
        notifySuccess("Выбранные сотрудники удалены.");
        await loadData();
      } catch (e: any) {
        notifyError(`Ошибка массового удаления: ${e?.message || e}`);
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
          notifySuccess("Сотрудник перемещён в команду.");
          await loadData();
        } catch (e: any) {
          notifyError(`Не удалось переместить сотрудника: ${e?.message || e}`);
        }
      }

      if (over.id === "unassigned-droppable-area") {
        const sourceTeam = allTeams.find((t) => t.members.some((m) => m.id === pyroId));
        if (!sourceTeam) return;

        const member_ids = sourceTeam.members.filter((m) => m.id !== pyroId).map((m) => m.id);
        try {
          await patchTeam(sourceTeam.id, { member_ids });
          notifySuccess("Сотрудник возвращён в резерв.");
          await loadData();
        } catch (e: any) {
          notifyError(`Не удалось вернуть сотрудника в резерв: ${e?.message || e}`);
        }
      }
    };

  const unitsCount = allUnits.length;
  const teamsCount = allTeams.length;
  const unassignedCount = unassigned.length;

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <Box sx={{ pb: 8 }}>
        <PageHeader
          title="Штатная структура и кадры"
          subtitle={`Подразделений: ${unitsCount} · Команд: ${teamsCount} · В резерве: ${unassignedCount}`}
          actions={
            isMobile ? (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Обновить">
                  <IconButton color="primary" onClick={loadData} disabled={loading}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Импорт">
                  <IconButton
                    color="primary"
                    component={RouterLink}
                    to="/structure/import"
                  >
                    <UploadFileIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadData}
                  disabled={loading}
                >
                  {loading ? "Обновление…" : "Обновить"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  component={RouterLink}
                  to="/structure/import"
                >
                  Импорт
                </Button>
              </Stack>
            )
          }
        />

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
                  <Typography variant="h6" gutterBottom>
                    Структура подразделений
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Подразделений: {unitsCount} · Команд: {teamsCount}
                  </Typography>
                </Box>
                <OrganizationTree
                  nodes={structure}
                  teamsMap={teamsMap}
                  onAddUnit={(parentId) =>
                    setUnitDialog({ open: true, unit: null, parentId })
                  }
                  onEditUnit={(unit) =>
                    setUnitDialog({ open: true, unit, parentId: null })
                  }
                  onDeleteUnit={handleDeleteUnit}
                  onEditTeam={(team) =>
                    setEditTeamDialog({ open: true, team })
                  }
                  onDeleteTeam={handleDeleteTeam}
                  onEditPyro={(p) =>
                    setPyroDialog({ open: true, pyro: p })
                  }
                  onDeletePyro={handleDeletePyro}
                  selectedIds={selectedIds}
                  onToggleSelection={(id) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    });
                  }}
                />
              </Grid>

              <Grid item xs={12} md={5} lg={4}>
                <Stack spacing={1.5} sx={{ height: "100%" }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    alignItems={{ sm: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Резерв сотрудников
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        В резерве: {unassignedCount}
                      </Typography>
                    </Box>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems="center"
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      <TextField
                        size="small"
                        placeholder="Поиск по ФИО"
                        value={unassignedFilter}
                        onChange={(e) => setUnassignedFilter(e.target.value)}
                        sx={{ width: { xs: "100%", sm: 180 } }}
                      />
                      <ButtonGroup size="small" sx={{ width: { xs: "100%", sm: "auto" } }}>
                        <Button
                          onClick={() =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              unassigned.forEach((p) => next.add(`pyro-${p.id}`));
                              return next;
                            })
                          }
                          sx={{ flexGrow: 1 }}
                        >
                          Выделить всех
                        </Button>
                        <Button
                          onClick={() =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              unassigned.forEach((p) => next.delete(`pyro-${p.id}`));
                              return next;
                            })
                          }
                          sx={{ flexGrow: 1 }}
                        >
                          Снять
                        </Button>
                      </ButtonGroup>
                    </Stack>
                  </Stack>

                  <UnassignedPyrosList
                    pyros={filteredUnassigned}
                    onAddPyro={() =>
                      setPyroDialog({ open: true, pyro: null })
                    }
                    onEditPyro={(p) =>
                      setPyroDialog({ open: true, pyro: p })
                    }
                    onDeletePyro={handleDeletePyro}
                    selectedIds={selectedIds}
                    onToggleSelection={(id) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      });
                    }}
                  />
                </Stack>
              </Grid>
            </Grid>

            {/* ИЗМЕНЕНИЕ: Уменьшаем и делаем адаптивными вертикальные отступы для большей компактности */}
            <Divider sx={{ my: { xs: 2.5, md: 3 } }}>
              <Chip label="Управление командами" />
            </Divider>

            <TeamsDashboard
              nodes={structure}
              onAddTeam={(unitId) =>
                setCreateTeamDialog({ open: true, unitId })
              }
              onEditTeam={(team) =>
                setEditTeamDialog({ open: true, team })
              }
              teamsMap={teamsMap}
            />
          </>
        )}

        <UnitDialog
          open={unitDialog.open}
          onClose={() =>
            setUnitDialog({ open: false, unit: null, parentId: null })
          }
          onSave={() => {
            setUnitDialog({ open: false, unit: null, parentId: null });
            void loadData();
          }}
          unit={unitDialog.unit}
          parentId={unitDialog.parentId}
        />
        <CreateTeamDialog
          open={createTeamDialog.open}
          onClose={() => setCreateTeamDialog({ open: false, unitId: null })}
          onCreated={() => {
            setCreateTeamDialog({ open: false, unitId: null });
            void loadData();
          }}
          allUnits={allUnits}
          initialUnitId={createTeamDialog.unitId}
        />
        <EditTeamDialog
          open={editTeamDialog.open}
          onClose={() => setEditTeamDialog({ open: false, team: null })}
          onUpdated={() => {
            setEditTeamDialog({ open: false, team: null });
            void loadData();
          }}
          team={editTeamDialog.team}
          allUnits={allUnits}
        />
        <PyrotechnicianDialog
          open={pyroDialog.open}
          onClose={() => setPyroDialog({ open: false, pyro: null })}
          onSave={() => {
            setPyroDialog({ open: false, pyro: null });
            void loadData();
          }}
          pyro={pyroDialog.pyro}
        />
        <ConfirmDeleteUnitDialog
          open={confirmDelete.open}
          unitName={confirmDelete.unit?.name || ""}
          onClose={() => setConfirmDelete({ open: false, unit: null })}
          onConfirm={confirmDeleteUnit}
          defaultMode="single"
          requireTyping
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