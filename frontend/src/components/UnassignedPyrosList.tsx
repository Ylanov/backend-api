// frontend/src/components/UnassignedPyrosList.tsx
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Checkbox, // Импортируем Checkbox
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { Pyrotechnician } from "../types";

// --- Карточка пиротехника (теперь с чекбоксом и новыми пропсами) ---
const PyroCard = ({
  pyro,
  onEdit,
  onDelete,
  isSelected,
  onToggleSelection,
}: {
  pyro: Pyrotechnician;
  onEdit: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
}) => {
  const pyroIdStr = `pyro-${pyro.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: pyroIdStr,
      data: {
        type: "pyro",
        id: pyro.id,
        name: pyro.full_name,
        source: "unassigned",
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: "default",
    zIndex: isDragging ? 1000 : "auto",
  } as const;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{ p: 1, pr: 1.5, bgcolor: isSelected ? 'action.selected' : 'transparent' }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={0.5} alignItems="center">
          {/* Чекбокс для выделения */}
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelection(pyroIdStr)}
            onClick={(e) => e.stopPropagation()}
            size="small"
          />
          {/* Ручка перетаскивания */}
          <Box
            {...listeners}
            {...attributes}
            sx={{
              display: "flex",
              alignItems: "center",
              cursor: "grab",
              px: 0.5,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <DragIndicatorIcon fontSize="small" color="action" />
          </Box>

          <PersonIcon color="action" sx={{ ml: 1 }}/>
          <Box>
            <Typography variant="body1" fontWeight={500}>
              {pyro.full_name}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Редактировать">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Удалить">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
};

// --- Основной компонент (теперь принимает пропсы для выделения) ---
type Props = {
  pyros: Pyrotechnician[];
  onAddPyro: () => void;
  onEditPyro: (pyro: Pyrotechnician) => void;
  onDeletePyro: (pyro: Pyrotechnician) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
};

export default function UnassignedPyrosList({
  pyros,
  onAddPyro,
  onEditPyro,
  onDeletePyro,
  selectedIds,
  onToggleSelection,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-droppable-area",
  });

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderColor: isOver ? "primary.main" : "divider",
        borderWidth: isOver ? 2 : 1,
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography variant="subtitle1">Резерв сотрудников</Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={onAddPyro}
          >
            Добавить
          </Button>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 1.5 }}>
        <Stack spacing={1}>
          {pyros.length === 0 ? (
            <Typography
              color="text.secondary"
              sx={{ p: 2, textAlign: "center" }}
            >
              Резерв пуст.
            </Typography>
          ) : (
            pyros.map((pyro) => (
              <PyroCard
                key={pyro.id}
                pyro={pyro}
                onEdit={() => onEditPyro(pyro)}
                onDelete={() => onDeletePyro(pyro)}
                // Передаем состояние и обработчик в каждую карточку
                isSelected={selectedIds.has(`pyro-${pyro.id}`)}
                onToggleSelection={onToggleSelection}
              />
            ))
          )}
        </Stack>
      </Box>
    </Paper>
  );
}