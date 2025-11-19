// frontend/src/pages/TasksPageHeader.tsx
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Stack,
  TextField,
  MenuItem,
  Button,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PageHeader from "../components/PageHeader";

export type TasksFilters = {
  q: string;
  status?: string | null;
  priority?: string | null;
};

type TasksPageHeaderProps = Readonly<{
  filters: TasksFilters;
  onFiltersChange: (patch: Partial<TasksFilters>) => void;
  onCreate: () => void;
}>;

export default function TasksPageHeader({
  filters,
  onFiltersChange,
  onCreate,
}: TasksPageHeaderProps) {
  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up("sm"));

  return (
    <PageHeader
      title="Задачи"
      subtitle="Управляйте задачами, командами и зонами"
      sticky
      actions={
        // Внутренний контейнер сам становится «колонкой» на телефонах
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(4, max-content)" },
            gap: 1,
            width: { xs: "100%", sm: "auto" },
            "& .MuiTextField-root, & .MuiButton-root": {
              width: { xs: "100%", sm: "auto" },
            },
          }}
        >
          <TextField
            size="small"
            placeholder="Поиск…"
            value={filters.q || ""}
            onChange={(event) => onFiltersChange({ q: event.target.value })}
            inputProps={{ "aria-label": "Поиск задач" }}
            sx={{ minWidth: { xs: "100%", sm: 180 } }}
          />

          <TextField
            size="small"
            select
            label="Статус"
            value={filters.status ?? ""}
            onChange={(event) =>
              onFiltersChange({ status: event.target.value || null })
            }
            sx={{ minWidth: { xs: "100%", sm: 160 } }}
          >
            <MenuItem value="">Все</MenuItem>
            <MenuItem value="NEW">Новая</MenuItem>
            <MenuItem value="IN_PROGRESS">В работе</MenuItem>
            <MenuItem value="DONE">Завершена</MenuItem>
            <MenuItem value="CANCELED">Отменена</MenuItem>
          </TextField>

          <TextField
            size="small"
            select
            label="Приоритет"
            value={filters.priority ?? ""}
            onChange={(event) =>
              onFiltersChange({ priority: event.target.value || null })
            }
            sx={{ minWidth: { xs: "100%", sm: 160 } }}
          >
            <MenuItem value="">Любой</MenuItem>
            <MenuItem value="CRITICAL">Критичный</MenuItem>
            <MenuItem value="HIGH">Высокий</MenuItem>
            <MenuItem value="NORMAL">Обычный</MenuItem>
          </TextField>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreate}
              fullWidth={!smUp}
            >
              Новая задача
            </Button>
          </Stack>
        </Box>
      }
    />
  );
}
