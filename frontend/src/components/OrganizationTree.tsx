// frontend/src/components/OrganizationTree.tsx
import { Fragment, useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  Collapse,
  Stack,
  Tooltip,
  IconButton,
  Typography,
  Paper,
  Button,
  Checkbox, // Импортируем Checkbox
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { OrganizationNode, Team, OrganizationUnit, Pyrotechnician } from "../types";

// Определяем пропсы с добавлением логики выделения
type TreeProps = {
  nodes: OrganizationNode[];
  onAddUnit: (parentId: number | null) => void;
  onEditUnit: (unit: OrganizationUnit) => void;
  onEditTeam: (team: Team) => void;
  onDeleteUnit: (unit: OrganizationUnit) => void;
  onDeleteTeam: (team: Team) => void;
  onEditPyro: (pyro: Pyrotechnician) => void;
  onDeletePyro: (pyro: Pyrotechnician) => void;
  teamsMap: Map<number, Team>;
  selectedIds: Set<string>; // Набор ID выделенных элементов
  onToggleSelection: (id: string) => void; // Функция для изменения выделения
};

// Функция парсинга ID (без изменений)
function parseNumericId(s: string): { type: string, id: number } | null {
  const match = s.match(/^(unit|team|pyro)-(\d+)$/);
  return match && match[2] ? { type: match[1], id: Number.parseInt(match[2], 10) } : null;
}

// Draggable-компонент для сотрудника (теперь с чекбоксом)
function DraggablePyroInTree({ node, onEdit, onDelete, isSelected, onToggleSelection }: {
    node: OrganizationNode,
    onEdit: () => void,
    onDelete: () => void,
    isSelected: boolean,
    onToggleSelection: (id: string) => void
}) {
  const parsed = parseNumericId(node.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: { type: 'pyro', id: parsed?.id, name: node.name, source: 'tree' },
  });
  const [hover, setHover] = useState(false);

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1, width: '100%' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={() => onToggleSelection(node.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <Stack
          direction="row"
          alignItems="center"
          sx={{ cursor: 'grab', width: '100%', py: 0.5 }}
          {...listeners}
          {...attributes}
        >
          <ListItemIcon sx={{ minWidth: 32 }}><PersonIcon fontSize="small" color="action" /></ListItemIcon>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>{node.name}</Typography>
        </Stack>
        {hover && (
          <Stack direction="row">
            <Tooltip title="Редактировать"><IconButton size="small" onClick={onEdit}><EditIcon fontSize="small"/></IconButton></Tooltip>
            <Tooltip title="Удалить"><IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small"/></IconButton></Tooltip>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

// Основной компонент дерева
export default function OrganizationTree(props: TreeProps) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderNodes = (nodes: OrganizationNode[], level: number): JSX.Element[] => {
    return nodes.map((node) => {
      const [hover, setHover] = useState(false);
      const parsedId = parseNumericId(node.id);
      if (!parsedId) return <Fragment key={node.id}></Fragment>;

      const { id, type } = parsedId;
      const isSelected = props.selectedIds.has(node.id);

      // --- Отрисовка УЗЛА-СОТРУДНИКА ---
      if (type === 'pyro') {
        const pyroData = { id, full_name: node.name } as Pyrotechnician;
        return (
            <ListItem key={node.id} sx={{ pl: 1 + level * 2.5, py: 0, display: 'flex', bgcolor: isSelected ? 'action.selected' : 'transparent', borderRadius: 1 }}>
                <DraggablePyroInTree
                    node={node}
                    onEdit={() => props.onEditPyro(pyroData)}
                    onDelete={() => props.onDeletePyro(pyroData)}
                    isSelected={isSelected}
                    onToggleSelection={props.onToggleSelection}
                />
            </ListItem>
        );
      }

      const { isOver, setNodeRef } = useDroppable({ id: node.id, data: { type, id } });
      const hasChildren = node.children && node.children.length > 0;
      const isOpen = !!openMap[node.id];

      // --- Отрисовка УЗЛА-КОМАНДЫ или УЗЛА-ПОДРАЗДЕЛЕНИЯ ---
      return (
        <Fragment key={node.id}>
          <ListItem
            disablePadding
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <Paper
              ref={setNodeRef}
              variant="outlined"
              sx={{
                width: '100%', p: 1, ml: level * 2,
                borderColor: isOver ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'action.selected' : 'background.paper',
                borderWidth: isOver ? 2 : 1,
              }}
            >
              <Stack direction="row" alignItems="center">
                <Checkbox
                  checked={isSelected}
                  onChange={() => props.onToggleSelection(node.id)}
                />
                <IconButton size="small" onClick={() => toggle(node.id)} sx={{ visibility: hasChildren ? 'visible' : 'hidden' }}>
                  {isOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {type === 'unit' ? <FolderIcon color="primary"/> : <GroupsIcon color="action" />}
                </ListItemIcon>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>{node.name}</Typography>
                    {node.description && <Typography variant="caption" color="text.secondary">{node.description}</Typography>}
                </Box>

                {hover && (
                  <Stack direction="row">
                    {type === 'unit' && (
                      <>
                        <Tooltip title="Добавить подраздел"><IconButton size="small" onClick={() => props.onAddUnit(id)}><CreateNewFolderIcon/></IconButton></Tooltip>
                        <Tooltip title="Редактировать"><IconButton size="small" onClick={() => props.onEditUnit({ id, name: node.name, description: node.description } as OrganizationUnit)}><EditIcon /></IconButton></Tooltip>
                        <Tooltip title="Удалить"><IconButton size="small" color="error" onClick={() => props.onDeleteUnit({ id, name: node.name } as OrganizationUnit)}><DeleteIcon /></IconButton></Tooltip>
                      </>
                    )}
                    {type === 'team' && (
                        <>
                            <Tooltip title="Редактировать"><IconButton size="small" onClick={() => props.onEditTeam(props.teamsMap.get(id)!)}><EditIcon /></IconButton></Tooltip>
                            <Tooltip title="Удалить"><IconButton size="small" color="error" onClick={() => props.onDeleteTeam(props.teamsMap.get(id)!)}><DeleteIcon /></IconButton></Tooltip>
                        </>
                    )}
                  </Stack>
                )}
              </Stack>
            </Paper>

            {hasChildren && (
              <Collapse in={isOpen} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
                <List disablePadding>
                  {renderNodes(node.children!, level + 1)}
                </List>
              </Collapse>
            )}
          </ListItem>
        </Fragment>
      );
    });
  };

  return (
    <Paper variant="outlined">
      <List>{renderNodes(props.nodes, 0)}</List>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={() => props.onAddUnit(null)} size="small" startIcon={<AddIcon />}>
            Добавить корневое подразделение
        </Button>
      </Box>
    </Paper>
  );
}