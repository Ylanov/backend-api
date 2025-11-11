// frontend/src/pages/OrganizationPage.tsx
import { useEffect, useState, Fragment } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";

// Иконки
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import GroupIcon from '@mui/icons-material/Group';

import type { OrganizationNode, OrganizationUnit, Team } from "../types";
import {
    fetchOrganizationStructure,
    deleteOrganizationUnit,
    fetchOrganizationUnits,
    fetchTeamById
} from "../services/api";

// Импортируем все необходимые диалоги
import UnitDialog from '../components/UnitDialog';
import CreateTeamDialog from '../components/CreateTeamDialog';
import EditTeamDialog from '../components/EditTeamDialog';

export default function OrganizationPage() {
  const [tree, setTree] = useState<OrganizationNode[] | null>(null);
  const [allUnits, setAllUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Состояние для диалога подразделений (Unit)
  const [isUnitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<Partial<OrganizationNode> | null>(null);
  const [parentUnitId, setParentUnitId] = useState<number | null>(null);

  // Состояние для диалогов команд (Team)
  const [isCreateTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [isEditTeamDialogOpen, setIsEditTeamDialogOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      // Загружаем одновременно и дерево, и плоский список подразделений для выпадающих списков
      const [treeData, unitsData] = await Promise.all([
        fetchOrganizationStructure(),
        fetchOrganizationUnits()
      ]);
      setTree(treeData);
      setAllUnits(unitsData);
    } catch(e) {
        console.error("Failed to load organization data", e);
        alert("Не удалось загрузить данные для страницы структуры.");
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  // --- Функции-обработчики для подразделений ---

  const handleAddRootUnit = () => {
    setUnitToEdit(null);
    setParentUnitId(null);
    setUnitDialogOpen(true);
  };

  const handleAddChildUnit = (node: OrganizationNode) => {
    const parentId = parseInt(node.id.replace('unit-', ''));
    setUnitToEdit(null);
    setParentUnitId(parentId);
    setUnitDialogOpen(true);
  };

  const handleEditUnit = (node: OrganizationNode) => {
    setUnitToEdit(node);
    setParentUnitId(null);
    setUnitDialogOpen(true);
  };

  const handleDeleteUnit = async (node: OrganizationNode) => {
    if (!window.confirm(`Вы уверены, что хотите удалить подразделение "${node.name}"? Это действие необратимо.`)) {
        return;
    }
    try {
        const unitId = parseInt(node.id.replace('unit-', ''));
        await deleteOrganizationUnit(unitId);
        load();
    } catch (error: any) {
        const detail = error.response?.data?.detail || error.message;
        alert(`Ошибка удаления: ${detail}`);
    }
  };

  // --- Функции-обработчики для команд ---

  const handleAddTeam = (node: OrganizationNode) => {
    const parentId = parseInt(node.id.replace('unit-', ''));
    setParentUnitId(parentId); // Передаем ID родителя для авто-выбора в диалоге
    setCreateTeamDialogOpen(true);
  };

  const handleEditTeam = async (node: OrganizationNode) => {
    try {
        const teamId = parseInt(node.id.replace('team-', ''));
        const teamData = await fetchTeamById(teamId); // Получаем полные данные команды
        setTeamToEdit(teamData);
        setIsEditTeamDialogOpen(true);
    } catch (error) {
        console.error("Failed to fetch team data for editing:", error);
        alert("Не удалось загрузить данные команды для редактирования.");
    }
  };

  // --- Общая функция для закрытия всех диалогов и обновления данных ---

  const closeAllDialogsAndRefresh = () => {
    setUnitDialogOpen(false);
    setCreateTeamDialogOpen(false);
    setIsEditTeamDialogOpen(false);
    setTeamToEdit(null);
    setUnitToEdit(null);
    load();
  }

  // --- Функция для рендеринга дерева ---

  const renderNode = (node: OrganizationNode, level: number) => (
    <Fragment key={node.id}>
        <Paper variant="outlined" sx={{ p: 1, my: 1, ml: level * 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {node.type === 'unit' ? <FolderIcon color="primary" /> : <GroupIcon color="action" />}
                    <Box>
                        <Typography variant="subtitle1" fontWeight={500}>{node.name}</Typography>
                        {node.description && <Typography variant="caption" color="text.secondary">{node.description}</Typography>}
                    </Box>
                </Stack>

                <Stack direction="row" spacing={0.5}>
                    {node.type === 'unit' && (
                        <>
                            <Tooltip title="Добавить команду в это подразделение">
                                <IconButton size="small" onClick={() => handleAddTeam(node)}><GroupAddIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="Добавить дочернее подразделение">
                                <IconButton size="small" onClick={() => handleAddChildUnit(node)}><CreateNewFolderIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="Редактировать подразделение">
                                <IconButton size="small" onClick={() => handleEditUnit(node)}><EditIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить подразделение">
                                <IconButton size="small" onClick={() => handleDeleteUnit(node)}><DeleteIcon color="error" /></IconButton>
                            </Tooltip>
                        </>
                    )}
                     {node.type === 'team' && (
                        <Tooltip title="Редактировать команду">
                            <IconButton size="small" onClick={() => handleEditTeam(node)}><EditIcon /></IconButton>
                        </Tooltip>
                    )}
                </Stack>
            </Stack>
        </Paper>
        {node.children?.map(child => renderNode(child, level + 1))}
    </Fragment>
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AccountTreeIcon />
          <Typography variant="h5">Штатная структура</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading} variant="outlined">
                {loading ? "Обновление…" : "Обновить"}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRootUnit}>
                Добавить корневое подразделение
            </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee' }}>
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={20} /> <span>Загрузка структуры…</span>
          </Stack>
        ) : tree && tree.length > 0 ? (
          tree.map(node => renderNode(node, 0))
        ) : (
          <Typography color="text.secondary">Структура пуста. Начните с создания корневого подразделения.</Typography>
        )}
      </Paper>

      {/* Диалоговые окна */}

      <UnitDialog
        open={isUnitDialogOpen}
        onClose={() => setUnitDialogOpen(false)}
        onSave={closeAllDialogsAndRefresh}
        unit={unitToEdit}
        parentId={parentUnitId}
      />
      <CreateTeamDialog
        open={isCreateTeamDialogOpen}
        onClose={() => setCreateTeamDialogOpen(false)}
        onCreated={closeAllDialogsAndRefresh}
        allUnits={allUnits}
        initialUnitId={parentUnitId}
      />
      <EditTeamDialog
        open={isEditTeamDialogOpen}
        onClose={() => setIsEditTeamDialogOpen(false)}
        onUpdated={closeAllDialogsAndRefresh}
        team={teamToEdit}
        allUnits={allUnits}
      />
    </Box>
  );
}